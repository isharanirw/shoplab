import { Modal } from './Modal';
import styles from './ClearCartModal.module.css';

interface ClearCartModalProps {
  itemCount: number;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * The "Clear cart" confirmation. It is a custom, accessible modal on purpose (the Remove button
 * uses the browser's native confirm dialog), so the two kinds of confirmation can be compared.
 */
export function ClearCartModal({ itemCount, busy, onConfirm, onCancel }: ClearCartModalProps) {
  return (
    <Modal labelledBy="clear-cart-title" onClose={onCancel}>
      <div className={styles.body} data-testid="clear-cart-modal">
        <h2 id="clear-cart-title" className={styles.title}>
          Clear your cart?
        </h2>
        <p id="clear-cart-description">
          This removes all {itemCount} {itemCount === 1 ? 'item' : 'items'} and any coupon from your cart. It cannot be undone.
        </p>
        <div className={styles.actions}>
          <button type="button" className="btn" onClick={onCancel} data-testid="clear-cart-cancel">
            Cancel
          </button>
          <button type="button" className={`btn ${styles.danger}`} disabled={busy} onClick={onConfirm} data-testid="clear-cart-confirm">
            Clear cart
          </button>
        </div>
      </div>
    </Modal>
  );
}
