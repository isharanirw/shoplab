import type { CartCoupon, CartItem, CartTotals } from '../api/types';
import { Totals } from '../components/Totals';
import { formatPrice } from '../lib/format';
import styles from './Checkout.module.css';

interface CheckoutSummaryProps {
  items: CartItem[];
  totals: CartTotals | null;
  coupon: CartCoupon | null;
  /** Cart item id to message, for lines the server said have a stock problem. */
  problems?: Record<number, string>;
  loading: boolean;
  testIdPrefix: string;
}

/** The order summary shown beside every checkout step: lines, then the same totals as the cart. */
export function CheckoutSummary({ items, totals, coupon, problems = {}, loading, testIdPrefix }: CheckoutSummaryProps) {
  return (
    <aside className={styles.summary} aria-labelledby="checkout-summary-heading" data-testid="checkout-summary">
      <h2 id="checkout-summary-heading" className={styles.summaryTitle}>
        Order summary
      </h2>
      <ul className={styles.summaryList}>
        {items.map((item) => (
          <li key={item.id} className={styles.summaryItem} data-testid={`summary-item-${item.productId}`}>
            <span className={styles.summaryName}>
              {item.quantity} × {item.name}
              {item.variantLabel ? ` (${item.variantLabel})` : ''}
            </span>
            <span className={styles.summaryPrice}>{formatPrice(item.lineTotalCents)}</span>
            {problems[item.id] && (
              <span className={styles.summaryProblem} role="alert">
                {problems[item.id]}
              </span>
            )}
          </li>
        ))}
      </ul>
      {coupon && (
        <p className={styles.help} data-testid="summary-coupon">
          Coupon {coupon.code}
          {coupon.applied ? ' applied.' : ` not applied. ${coupon.message ?? ''}`}
        </p>
      )}
      {totals && <Totals totals={totals} coupon={coupon} testIdPrefix={testIdPrefix} />}
      {loading && <p className={styles.help}>Updating totals...</p>}
    </aside>
  );
}
