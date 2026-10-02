import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { CartCoupon, CartItem, CartTotals } from '../api/types';
import { formatPrice } from '../lib/format';
import { CartLineItem } from './CartLineItem';
import { ClearCartModal } from './ClearCartModal';
import { Totals } from './Totals';
import styles from './CartContent.module.css';
import { ActionError } from './ActionError';
import type { Failure } from '../lib/failure';

export interface CouponFeedback {
  kind: 'success' | 'error';
  text: string;
  /** True when the request failed in a way that trying again could fix. */
  transient?: boolean;
}

interface CartContentProps {
  items: CartItem[];
  /** Guests see the subtotal only: coupons, shipping, tax and the total need an account. */
  guest: boolean;
  subtotalCents: number;
  totals: CartTotals | null;
  coupon: CartCoupon | null;
  busy: boolean;
  /** Success text for the last change, announced politely. */
  message: string | null;
  /** The last change that failed. */
  error: Failure | null;
  onQuantity: (item: CartItem, quantity: number) => void;
  onRemove: (item: CartItem) => void;
  onClear: () => Promise<void>;
  onApplyCoupon: (code: string) => Promise<CouponFeedback>;
  onRemoveCoupon: () => Promise<void>;
}

export function CartContent(props: CartContentProps) {
  const { items, guest, totals, coupon, busy } = props;
  const [clearOpen, setClearOpen] = useState(false);
  const [code, setCode] = useState('');
  const [feedback, setFeedback] = useState<CouponFeedback | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);

  // A coupon message describes the cart as it was when it appeared, so drop it when the cart changes.
  useEffect(() => {
    setFeedback(null);
  }, [props.subtotalCents]);

  const itemCount = items.reduce((n, i) => n + i.quantity, 0);
  const blocked = items.some((i) => !i.inStock || i.quantity > i.stock);

  function handleApply(event: FormEvent) {
    event.preventDefault();
    void applyCode(code);
  }

  async function applyCode(value: string) {
    if (couponBusy) return;
    setCouponBusy(true);
    setFeedback(null);
    try {
      const result = await props.onApplyCoupon(value);
      setFeedback(result);
      if (result.kind === 'success') setCode('');
    } finally {
      setCouponBusy(false);
    }
  }

  async function handleRemoveCoupon() {
    setFeedback(null);
    setCouponBusy(true);
    try {
      await props.onRemoveCoupon();
      setFeedback({ kind: 'success', text: 'Coupon removed.' });
    } finally {
      setCouponBusy(false);
    }
  }

  async function handleClear() {
    await props.onClear();
    setClearOpen(false);
    setFeedback(null);
  }

  return (
    <div className={styles.layout}>
      <div className={styles.lines}>
        <div role="status" className={styles.message} data-testid="cart-message">
          {props.message}
        </div>
        {props.error && <ActionError failure={props.error} className={styles.error} testId="cart-error" />}
        <ul className={styles.list} aria-label="Cart items" data-testid="cart-items">
          {items.map((item) => (
            <CartLineItem key={`${item.productId}:${item.variantId ?? 0}`} item={item} busy={busy} onQuantity={props.onQuantity} onRemove={props.onRemove} />
          ))}
        </ul>
        <p className={styles.clearRow}>
          <button type="button" className="btn btn-small" onClick={() => setClearOpen(true)} disabled={busy} data-testid="clear-cart">
            Clear cart
          </button>
        </p>
      </div>

      <aside className={styles.summary} aria-labelledby="summary-heading">
        <h2 id="summary-heading" className={styles.summaryTitle}>
          Order summary
        </h2>
        <p className={styles.count} data-testid="cart-item-count">
          {itemCount} {itemCount === 1 ? 'item' : 'items'}
        </p>

        {guest ? (
          <>
            <dl className={styles.subtotal}>
              <dt>Subtotal</dt>
              <dd data-testid="cart-subtotal">{formatPrice(props.subtotalCents)}</dd>
            </dl>
            <p className={styles.guestNote} data-testid="guest-note">
              <Link to="/login?next=%2Fcart">Log in</Link> to apply a coupon and see shipping, tax and your total. Your cart will be kept.
            </p>
            <Link to="/checkout" className="btn btn-primary" data-testid="checkout-button">
              Log in to check out
            </Link>
          </>
        ) : (
          <>
            <section className={styles.coupon} aria-labelledby="coupon-heading">
              <h3 id="coupon-heading" className={styles.couponTitle}>
                Coupon
              </h3>
              <form onSubmit={handleApply} className={styles.couponForm} noValidate>
                <label htmlFor="coupon-code" className={styles.couponLabel}>
                  Coupon code
                </label>
                <div className={styles.couponRow}>
                  <input
                    id="coupon-code"
                    type="text"
                    className={`control ${styles.couponInput}`}
                    value={code}
                    autoComplete="off"
                    onChange={(e) => setCode(e.target.value)}
                    data-testid="coupon-input"
                  />
                  <button type="submit" className="btn" disabled={couponBusy || busy} data-testid="apply-coupon">
                    Apply
                  </button>
                </div>
              </form>
              <div role="status" aria-live="polite" data-testid="coupon-message">
                {feedback && (
                  <p className={feedback.kind === 'success' ? styles.couponOk : styles.couponError}>
                    {feedback.text}
                    {feedback.transient && (
                      <>
                        {' '}
                        <button type="button" className="btn btn-small" onClick={() => void applyCode(code)}>
                          Retry
                        </button>
                      </>
                    )}
                  </p>
                )}
              </div>
              {coupon && (
                <div className={styles.applied} data-testid="applied-coupon">
                  <p className={styles.appliedText}>
                    <strong>{coupon.code}</strong>: {coupon.description}
                  </p>
                  {!coupon.applied && coupon.message && (
                    <p className={styles.couponError} data-testid="coupon-inactive">
                      Not applied right now. {coupon.message}
                    </p>
                  )}
                  <button type="button" className="btn btn-small" onClick={() => void handleRemoveCoupon()} disabled={couponBusy || busy} data-testid="remove-coupon">
                    Remove coupon
                  </button>
                </div>
              )}
            </section>

            {totals && <Totals totals={totals} coupon={coupon} testIdPrefix="cart" />}
            <p className={styles.shippingNote}>Standard shipping shown. You choose Standard or Express at checkout.</p>
            {blocked && (
              <p role="alert" className={styles.error}>
                Fix the items marked above before you check out.
              </p>
            )}
            {blocked ? (
              <button type="button" className="btn btn-primary" disabled data-testid="checkout-button">
                Proceed to checkout
              </button>
            ) : (
              <Link to="/checkout" className="btn btn-primary" data-testid="checkout-button">
                Proceed to checkout
              </Link>
            )}
          </>
        )}
      </aside>

      {clearOpen && (
        <ClearCartModal itemCount={itemCount} busy={busy} onConfirm={() => void handleClear()} onCancel={() => setClearOpen(false)} />
      )}
    </div>
  );
}
