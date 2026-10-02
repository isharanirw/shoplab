import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiRequestError } from '../api/client';
import type { Country, ListResponse, SavedAddress } from '../api/types';
import { ConfirmModal } from '../components/ConfirmModal';
import { ErrorState, Spinner } from '../components/Feedback';
import { useFetch } from '../hooks/useFetch';
import { addressSummary } from '../lib/addressBook';
import { AddressEditor } from './AddressEditor';
import styles from './Account.module.css';
import { ActionError } from '../components/ActionError';
import { failureOf, isTransientError } from '../lib/failure';
import type { Failure } from '../lib/failure';

type Editing = { kind: 'new' } | { kind: 'edit'; address: SavedAddress } | null;

/** The address book on /account: list, default-address radio, add, edit and delete (with a confirm modal). */
export function AddressBook() {
  const addresses = useFetch<ListResponse<SavedAddress>>('/api/addresses');
  const countries = useFetch<ListResponse<Country>>('/api/countries');
  const [list, setList] = useState<SavedAddress[] | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<SavedAddress | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteRetryable, setDeleteRetryable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [problem, setProblem] = useState<Failure | null>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const focusAddButton = useRef(false);

  // Focus goes back to the Add button once the editor or the delete dialog has closed (the page is inert while a dialog is open).
  useEffect(() => {
    if (editing === null && deleting === null && focusAddButton.current) {
      focusAddButton.current = false;
      addButtonRef.current?.focus();
    }
  }, [editing, deleting]);

  useEffect(() => {
    if (addresses.status === 'success') setList(addresses.data.data);
  }, [addresses.status, addresses.data]);

  const reload = useCallback(async () => {
    const fresh = await api<ListResponse<SavedAddress>>('/api/addresses');
    setList(fresh.data);
  }, []);

  async function makeDefault(address: SavedAddress) {
    if (address.isDefault) return;
    setProblem(null);
    setMessage(null);
    try {
      await api<SavedAddress>(`/api/addresses/${address.id}`, { method: 'PATCH', body: { isDefault: true } });
      await reload();
      setMessage(`${address.label} is now your default address.`);
    } catch (err) {
      setProblem(failureOf(err, 'Could not change the default address.', () => void makeDefault(address)));
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    setDeleteError(null);
    setDeleteRetryable(false);
    try {
      await api<void>(`/api/addresses/${deleting.id}`, { method: 'DELETE' });
      const label = deleting.label;
      await reload().catch(() => undefined);
      setMessage(`Deleted ${label}.`);
      focusAddButton.current = true;
      setDeleting(null);
    } catch (err) {
      setDeleteError(err instanceof ApiRequestError ? err.message : 'Could not delete the address. Please try again.');
      setDeleteRetryable(isTransientError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleSaved(saved: SavedAddress, wasEdit: boolean) {
    try {
      await reload();
    } catch {
      // The list is refreshed on the next visit; the saved message below is still true.
    }
    setMessage(wasEdit ? `Saved changes to ${saved.label}.` : `Added ${saved.label}.`);
    focusAddButton.current = true;
    setEditing(null);
  }

  const failed = [addresses, countries].find((r) => r.status === 'error');
  const loaded = list !== null && countries.status === 'success';
  const defaultRemains = deleting?.isDefault && (list?.length ?? 0) > 1;

  return (
    <section className={styles.section} aria-labelledby="addresses-heading">
      <h2 id="addresses-heading">Address book</h2>

      {failed && failed.status === 'error' && (
        <ErrorState
          message={failed.error.message}
          onRetry={() => {
            addresses.retry();
            countries.retry();
          }}
        />
      )}
      {!failed && !loaded && <Spinner label="Loading your addresses" />}

      {loaded && (
        <>
          <div role="status" aria-live="polite" className={styles.statusLine}>
            {message && <p data-testid="address-message">{message}</p>}
          </div>
          {problem && <ActionError failure={problem} className={styles.problem} />}

          {list.length === 0 ? (
            <p data-testid="address-empty">You have no saved addresses yet.</p>
          ) : (
            <fieldset className={styles.defaultSet}>
              <legend className={styles.visuallyLegend}>Default address</legend>
              <ul className={styles.addressList} data-testid="address-list">
                {list.map((a) => (
                  <li key={a.id} className={styles.addressCard} data-testid={`address-card-${a.id}`}>
                    <div className={styles.addressText}>
                      <p className={styles.addressLabel}>
                        <strong>{a.label}</strong>
                        {a.isDefault && <span className={styles.defaultBadge}>Default</span>}
                      </p>
                      <p>
                        {a.firstName} {a.lastName}
                      </p>
                      <p>{addressSummary(a)}</p>
                      <p>Phone {a.phone}</p>
                    </div>
                    <div className={styles.addressActions}>
                      <div className={styles.radioRow}>
                        <input
                          type="radio"
                          id={`default-address-${a.id}`}
                          name="default-address"
                          checked={a.isDefault}
                          onChange={() => void makeDefault(a)}
                          data-testid={`address-default-${a.id}`}
                        />
                        <label htmlFor={`default-address-${a.id}`}>
                          Default address<span className="visually-hidden">: {a.label}</span>
                        </label>
                      </div>
                      <div className={styles.buttonRow}>
                        <button
                          type="button"
                          className="btn btn-small"
                          aria-label={`Edit ${a.label}`}
                          onClick={() => {
                            setMessage(null);
                            setEditing({ kind: 'edit', address: a });
                          }}
                          data-testid={`address-edit-${a.id}`}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-small"
                          aria-label={`Delete ${a.label}`}
                          onClick={() => {
                            setMessage(null);
                            setDeleteError(null);
                            setDeleting(a);
                          }}
                          data-testid={`address-delete-${a.id}`}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </fieldset>
          )}

          {editing ? (
            <AddressEditor
              key={editing.kind === 'edit' ? editing.address.id : 'new'}
              address={editing.kind === 'edit' ? editing.address : null}
              countries={countries.data.data}
              isFirst={list.length === 0}
              onSaved={(saved) => void handleSaved(saved, editing.kind === 'edit')}
              onCancel={() => {
                setEditing(null);
                focusAddButton.current = true;
              }}
            />
          ) : (
            <button
              type="button"
              ref={addButtonRef}
              className="btn btn-primary"
              onClick={() => {
                setMessage(null);
                setEditing({ kind: 'new' });
              }}
              data-testid="address-add"
            >
              Add address
            </button>
          )}
        </>
      )}

      {deleting && (
        <ConfirmModal
          idPrefix="delete-address"
          title="Delete this address?"
          confirmLabel="Delete address"
          cancelLabel="Keep it"
          busy={busy}
          error={deleteError}
          errorRetryable={deleteRetryable}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleting(null)}
        >
          <p>
            <strong>{deleting.label}</strong>: {addressSummary(deleting)}
          </p>
          <p>
            This removes it from your address book. Orders you already placed keep their address.
            {defaultRemains ? ' Your earliest remaining address will become the default.' : ''}
          </p>
        </ConfirmModal>
      )}
    </section>
  );
}
