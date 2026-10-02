import type { ReactNode } from 'react';
import { Modal } from './Modal';
import styles from './ConfirmModal.module.css';

interface ConfirmModalProps {
  /** Unique ID prefix so the dialog title and description can be linked. */
  idPrefix: string;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  /** An error from the last attempt, shown inside the dialog. */
  error?: string | null;
  /** True when the error is one that trying again could fix; shows a Retry button that repeats the action. */
  errorRetryable?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** A custom confirmation dialog for destructive actions (delete an address, cancel an order). */
export function ConfirmModal({ idPrefix, title, children, confirmLabel, cancelLabel = 'Keep it', busy = false, error, errorRetryable = false, onConfirm, onCancel }: ConfirmModalProps) {
  return (
    <Modal labelledBy={`${idPrefix}-title`} onClose={onCancel}>
      <div className={styles.body} data-testid={`${idPrefix}-modal`}>
        <h2 id={`${idPrefix}-title`} className={styles.title}>
          {title}
        </h2>
        <div>{children}</div>
        {error && (
          <p role="alert" className={styles.error}>
            {error}
            {errorRetryable && (
              <>
                {' '}
                <button type="button" className="btn btn-small" disabled={busy} onClick={onConfirm}>
                  Retry
                </button>
              </>
            )}
          </p>
        )}
        <div className={styles.actions}>
          <button type="button" className="btn" onClick={onCancel} data-testid={`${idPrefix}-cancel`}>
            {cancelLabel}
          </button>
          <button type="button" className={`btn ${styles.danger}`} disabled={busy} onClick={onConfirm} data-testid={`${idPrefix}-confirm`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
