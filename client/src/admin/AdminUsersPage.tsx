import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, ApiRequestError } from '../api/client';
import type { AdminUser, ListResponse } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { ErrorState, Spinner } from '../components/Feedback';
import { Pagination } from '../components/Pagination';
import { useFetch } from '../hooks/useFetch';
import { adminListApiPath, adminListSearch, parseAdminListState, USERS_LIST } from '../lib/adminList';
import type { AdminListState } from '../lib/adminList';
import { formatDate, pluralise } from '../lib/format';
import { totalPagesOf } from '../lib/pagination';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import styles from './Admin.module.css';

/** /admin/users: all accounts with a lock/unlock switch. An admin cannot lock their own account. */
export function AdminUsersPage() {
  useDocumentTitle('Manage users');
  const { user: me } = useAuth();
  const [params, setParams] = useSearchParams();
  const state = parseAdminListState(params, USERS_LIST);
  const result = useFetch<ListResponse<AdminUser>>(adminListApiPath('/api/admin/users', state, USERS_LIST));
  const [searchText, setSearchText] = useState(state.q);
  const [updated, setUpdated] = useState<Record<number, AdminUser>>({});
  const [busyId, setBusyId] = useState<number | null>(null);
  const [rowError, setRowError] = useState<{ id: number; message: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setSearchText(state.q);
  }, [state.q]);

  function change(patch: Partial<AdminListState>) {
    setNotice(null);
    setRowError(null);
    setUpdated({});
    setParams(new URLSearchParams(adminListSearch({ ...state, ...patch }, USERS_LIST)));
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    change({ q: searchText, page: 1 });
  }

  async function setLocked(user: AdminUser, locked: boolean) {
    setBusyId(user.id);
    setRowError(null);
    setNotice(null);
    try {
      const saved = await api<AdminUser>(`/api/admin/users/${user.id}/lock`, { method: 'PATCH', body: { locked } });
      setUpdated((prev) => ({ ...prev, [saved.id]: saved }));
      setNotice(`${saved.email} is now ${saved.locked ? 'locked' : 'unlocked'}.`);
    } catch (err) {
      setRowError({ id: user.id, message: err instanceof ApiRequestError ? err.message : 'Could not change the account. Please try again.' });
    } finally {
      setBusyId(null);
    }
  }

  const data = result.status === 'success' ? result.data : null;
  const totalPages = data ? totalPagesOf(data.total, data.pageSize) : 0;

  return (
    <section aria-labelledby="admin-users-heading">
      <h1 id="admin-users-heading">Manage users</h1>

      <div className={styles.toolbar}>
        <form role="search" aria-label="Search users" className={styles.searchForm} onSubmit={submitSearch}>
          <div className={styles.toolbarField}>
            <label htmlFor="admin-user-search">Search users</label>
            <input
              id="admin-user-search"
              type="search"
              className="control"
              value={searchText}
              maxLength={100}
              placeholder="Name or email contains..."
              onChange={(e) => setSearchText(e.target.value)}
              data-testid="admin-user-search"
            />
          </div>
          <button type="submit" className="btn">
            Search
          </button>
        </form>
      </div>
      <p className={styles.hint}>
        A locked user cannot log in and is logged out of every device straight away. Unlocking lets them log in again. You cannot lock your own account.
      </p>

      <div role="status" aria-live="polite">
        {notice && (
          <p className={styles.success} data-testid="admin-notice">
            {notice}
          </p>
        )}
      </div>

      {result.status === 'loading' && <Spinner label="Loading users" />}
      {result.status === 'error' && <ErrorState message={result.error.message} onRetry={result.retry} />}

      {data && (
        <>
          <p className={styles.count} data-testid="admin-user-count">
            {data.total === 0
              ? 'No users found.'
              : `${pluralise(data.total, 'user')}${state.q ? ` matching "${state.q}"` : ''}, page ${data.page} of ${Math.max(totalPages, 1)}`}
          </p>
          {data.data.length === 0 ? (
            <div className={styles.empty}>
              <p>{data.total === 0 ? 'No users match your search.' : `There are no users on page ${data.page}.`}</p>
              <button type="button" className="btn" onClick={() => change({ page: 1, q: data.total === 0 ? '' : state.q })}>
                {data.total === 0 ? 'Clear search' : 'Go to page 1'}
              </button>
            </div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table} data-testid="admin-users-table">
                <caption className="visually-hidden">Users</caption>
                <thead>
                  <tr>
                    <th scope="col" className={styles.hideNarrow}>
                      ID
                    </th>
                    <th scope="col">Name</th>
                    <th scope="col">Email</th>
                    <th scope="col" className={styles.hideNarrow}>
                      Role
                    </th>
                    <th scope="col" className={styles.hideNarrow}>
                      Joined
                    </th>
                    <th scope="col">Locked</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((original) => {
                    const u = updated[original.id] ?? original;
                    const isMe = me?.id === u.id;
                    return (
                      <tr key={u.id} data-testid={`admin-user-row-${u.id}`}>
                        <td className={styles.hideNarrow}>{u.id}</td>
                        <th scope="row">
                          {u.name}
                          {isMe ? ' (you)' : ''}
                        </th>
                        <td>{u.email}</td>
                        <td className={styles.hideNarrow}>{u.role === 'admin' ? 'Admin' : 'Customer'}</td>
                        <td className={styles.hideNarrow}>{formatDate(u.createdAt)}</td>
                        <td>
                          <label className={styles.switchRow}>
                            <input
                              type="checkbox"
                              role="switch"
                              checked={u.locked}
                              disabled={busyId === u.id || isMe}
                              aria-label={`Locked: ${u.email}`}
                              onChange={(e) => void setLocked(u, e.target.checked)}
                              data-testid={`admin-user-lock-${u.id}`}
                            />
                            <span className={`${styles.badge} ${u.locked ? styles.badgeLocked : styles.badgeActive}`}>{u.locked ? 'Locked' : 'Active'}</span>
                          </label>
                          {isMe && <span className={styles.hint}> Your own account</span>}
                          {rowError?.id === u.id && (
                            <p role="alert" className={styles.problem} data-testid={`admin-user-error-${u.id}`}>
                              {rowError.message}
                            </p>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <Pagination page={data.page} totalPages={totalPages} onChange={(page) => change({ page })} label="User pages" />
        </>
      )}
    </section>
  );
}
