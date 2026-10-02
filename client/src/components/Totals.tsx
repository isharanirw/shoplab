import type { CartCoupon, CartTotals } from '../api/types';
import { formatPrice } from '../lib/format';
import styles from './Totals.module.css';

interface TotalsProps {
  totals: CartTotals;
  coupon: CartCoupon | null;
  /** Prefix for the data-testid values: `cart` gives cart-subtotal, cart-discount, cart-shipping, cart-tax and cart-total. */
  testIdPrefix: string;
}

/**
 * The totals breakdown shared by the cart and the checkout summary. Money is shown exactly as the
 * API calculated it. A FREESHIP coupon has no money discount: the discount stays $0.00 and the
 * shipping line shows $0.00 and says it is free.
 */
export function Totals({ totals, coupon, testIdPrefix }: TotalsProps) {
  const appliedCode = coupon?.applied ? coupon.code : null;
  const method = totals.shippingMethod === 'express' ? 'Express' : 'Standard';
  const freeShipping = totals.shippingCents === 0 && totals.subtotalCents > 0;
  return (
    <dl className={styles.totals} data-testid={`${testIdPrefix}-totals`}>
      <div className={styles.row}>
        <dt>Subtotal</dt>
        <dd data-testid={`${testIdPrefix}-subtotal`}>{formatPrice(totals.subtotalCents)}</dd>
      </div>
      <div className={styles.row}>
        <dt>{appliedCode ? `Discount (${appliedCode})` : 'Discount'}</dt>
        <dd data-testid={`${testIdPrefix}-discount`}>{totals.discountCents > 0 ? `-${formatPrice(totals.discountCents)}` : formatPrice(0)}</dd>
      </div>
      <div className={styles.row}>
        <dt>{freeShipping ? `Shipping (${method}, free)` : `Shipping (${method})`}</dt>
        <dd data-testid={`${testIdPrefix}-shipping`}>{formatPrice(totals.shippingCents)}</dd>
      </div>
      <div className={styles.row}>
        <dt>Tax (10%)</dt>
        <dd data-testid={`${testIdPrefix}-tax`}>{formatPrice(totals.taxCents)}</dd>
      </div>
      <div className={`${styles.row} ${styles.total}`}>
        <dt>Total</dt>
        <dd data-testid={`${testIdPrefix}-total`}>{formatPrice(totals.totalCents)}</dd>
      </div>
    </dl>
  );
}
