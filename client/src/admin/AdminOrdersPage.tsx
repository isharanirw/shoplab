import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, ApiRequestError } from '../api/client';
import type { AdminOrder, ListResponse } from '../api/types';
import { ErrorState, Spinner } from '../components/Feedback';
import { OrderStatusBadge } from '../components/OrderStatusBadge';
import { Pagination } from '../components/Pagination';
import { useFetch } from '../hooks/useFetch';
import { adminListApiPath, adminListSearch, ORDERS_LIST, parseAdminListState } from '../lib/adminList';
import type { AdminListState } from '../lib/adminList';
import { formatDate, formatPrice, pluralise } from '../lib/format';
import { ORDER_STATUSES } from '../lib/orders';
import { totalPagesOf } from '../lib/pagination';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import styles from './Admin.module.css';

/** /admin/orders: every customer order, newest first, with a status filter and a status dropdown per order. */
export function AdminOrdersPage() {
  useDocumentTitle('Manage orders');
  const [params, setParams] = useSearchParams();
  const state = parseAdminListState(params, ORDERS_LIST);
  const result = useFetch<ListResponse<AdminOrder>>(adminListApiPath('/api/admin/orders', state, ORDERS_LIST));
  // A change made here replaces the row from the list until the list is loaded again.
  const [updated, setUpdated] = useState<Record<number, AdminOrder>>({});
  const [busyId, setBusyId] = useState<number | null>(null);
  const [rowError, setRowError] = useState<{ id: number; message: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function change(patch: Partial<AdminListState>) {
    setNotice(null);
    setRowError(null);
    setUpdated({});
    setParams(new URLSearchParams(adminListSearch({ ...state, ...patch }, ORDERS_LIST)));
  }

  async function changeStatus(order: AdminOrder, status: string) {
    if (status === order.status) return;
    setBusyId(order.id);
    setRowError(null);
    setNotice(null);
    try {
      const saved = await api<AdminOrder>(`/api/admin/orders/${order.id}/status`, { method: 'PATCH', body: { status } });
      setUpdated((prev) => ({ ...prev, [saved.id]: saved }));
      setNotice(`Order ${saved.number} is now ${saved.status}.${saved.status === 'Cancelled' ? ' Its stock was returned.' : ''}`);
    } catch (err) {
      setRowError({ id: order.id, message: err instanceof ApiRequestError ? err.message : 'Could not change the status. Please try again.' });
    } finally {
      setBusyId(null);
    }
  }

  const data = result.status === 'success' ? result.data : null;
  const totalPages = data ? totalPagesOf(data.total, data.pageSize) : 0;

  return (
    <section aria-labelledby="admin-orders-heading">
      <h1 id="admin-orders-heading">Manage orders</h1>

      <div className={styles.toolbar}>
        <div className={styles.toolbarField}>
          <label htmlFor="admin-order-filter">Status</label>
          <select
            id="admin-order-filter"
            className="control"
            value={state.filter}
            onChange={(e) => change({ filter: e.target.value, page: 1 })}
            data-testid="admin-order-filter"
          >
            <option value="">All statuses</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className={styles.hint}>
        Orders move forward only: Processing to Shipped to Delivered. An order can be cancelled while it is Processing or Shipped, which returns its stock.
        Delivered and Cancelled orders cannot change.
      </p>

      <div role="status" aria-live="polite">
        {notice && (
          <p className={styles.success} data-testid="admin-notice">
            {notice}
          </p>
        )}
      </div>

      {result.status === 'loading' && <Spinner label="Loading orders" />}
      {result.status === 'error' && <ErrorState message={result.error.message} onRetry={result.retry} />}

      {data && (
        <>
          <p className={styles.count} data-testid="admin-order-count">
            {data.total === 0
              ? 'No orders found.'
              : `${pluralise(data.total, 'order')}${state.filter ? ` with status ${state.filter}` : ''}, page ${data.page} of ${Math.max(totalPages, 1)}`}
          </p>
          {data.data.length === 0 ? (
            <div className={styles.empty}>
              <p>{data.total === 0 ? 'No orders match the filter.' : `There are no orders on page ${data.page}.`}</p>
              <button type="button" className="btn" onClick={() => change({ page: 1, filter: data.total === 0 ? '' : state.filter })}>
                {data.total === 0 ? 'Show all orders' : 'Go to page 1'}
              </button>
            </div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table} data-testid="admin-orders-table">
                <caption className="visually-hidden">Orders, newest first</caption>
                <thead>
                  <tr>
                    <th scope="col">Order</th>
                    <th scope="col">Customer</th>
                    <th scope="col" className={styles.hideNarrow}>
                      Date
                    </th>
                    <th scope="col" className={`${styles.right} ${styles.hideNarrow}`}>
                      Items
                    </th>
                    <th scope="col" className={styles.right}>
                      Total
                    </th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((original) => {
                    const o = updated[original.id] ?? original;
                    return (
                      <tr key={o.id} data-testid={`admin-order-row-${o.id}`}>
                        <th scope="row">{o.number}</th>
                        <td>
                          {o.customer.name}
                          <span className={styles.subline}>{o.customer.email}</span>
                        </td>
                        <td className={styles.hideNarrow}>{formatDate(o.createdAt)}</td>
                        <td className={`${styles.right} ${styles.hideNarrow}`}>{o.itemCount}</td>
                        <td className={styles.right}>{formatPrice(o.totalCents)}</td>
                        <td>
                          <OrderStatusBadge status={o.status} />
                          <div>
                            <label htmlFor={`order-status-${o.id}`} className="visually-hidden">
                              Change status of order {o.number}
                            </label>
                            <select
                              id={`order-status-${o.id}`}
                              className={`control ${styles.statusSelect}`}
                              value={o.status}
                              disabled={busyId === o.id}
                              onChange={(e) => void changeStatus(o, e.target.value)}
                              data-testid={`admin-order-status-${o.id}`}
                            >
                              {ORDER_STATUSES.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          </div>
                          {rowError?.id === o.id && (
                            <p role="alert" className={styles.problem} data-testid={`admin-order-error-${o.id}`}>
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
          <Pagination page={data.page} totalPages={totalPages} onChange={(page) => change({ page })} label="Order pages" />
        </>
      )}
    </section>
  );
}
