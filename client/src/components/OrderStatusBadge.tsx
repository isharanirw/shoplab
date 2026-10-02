import styles from './OrderStatusBadge.module.css';

const CLASS_BY_STATUS: Record<string, string> = {
  Processing: styles.processing ?? '',
  Shipped: styles.shipped ?? '',
  Delivered: styles.delivered ?? '',
  Cancelled: styles.cancelled ?? '',
};

/** The order status as text in a coloured pill (never colour alone). */
export function OrderStatusBadge({ status }: { status: string }) {
  return (
    <span className={`${styles.badge} ${CLASS_BY_STATUS[status] ?? ''}`} data-testid="order-status">
      {status}
    </span>
  );
}
