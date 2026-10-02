import { Link, useParams } from 'react-router-dom';
import type { CartCoupon, Order } from '../api/types';
import { ErrorState, Spinner } from '../components/Feedback';
import { Totals } from '../components/Totals';
import { useFetch } from '../hooks/useFetch';
import { shortDate } from '../lib/delivery';
import { formatDate, formatPrice } from '../lib/format';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import styles from './OrderConfirmationPage.module.css';

/** /orders/:id/confirmation: what the shopper sees right after placing an order. */
export function OrderConfirmationPage() {
  const { id } = useParams();
  const validId = id !== undefined && /^[1-9]\d{0,8}$/.test(id);
  const result = useFetch<Order>(validId ? `/api/orders/${id}` : null);
  useDocumentTitle('Order confirmation');

  if (!validId || (result.status === 'error' && (result.error.status === 404 || result.error.status === 400))) {
    return (
      <section aria-labelledby="order-heading" data-testid="order-not-found">
        <h1 id="order-heading">Order not found</h1>
        <p>We could not find that order in your account.</p>
        <p>
          <Link to="/products">Continue shopping</Link>
        </p>
      </section>
    );
  }
  if (result.status === 'loading') {
    return (
      <section aria-labelledby="order-heading">
        <h1 id="order-heading" className="visually-hidden">
          Order confirmation
        </h1>
        <Spinner label="Loading your order" />
      </section>
    );
  }
  if (result.status === 'error') {
    return (
      <section aria-labelledby="order-heading">
        <h1 id="order-heading" className="visually-hidden">
          Order confirmation
        </h1>
        <ErrorState message={result.error.message} onRetry={result.retry} />
      </section>
    );
  }

  const order = result.data;
  const coupon: CartCoupon | null = order.couponCode
    ? { code: order.couponCode, description: '', applied: true, reason: null, message: null }
    : null;
  const address = order.address;

  return (
    <section aria-labelledby="order-heading" className={styles.page} data-testid="order-confirmation">
      <h1 id="order-heading">Thank you, your order is placed</h1>
      <p className={styles.number}>
        Order number: <strong data-testid="order-number">{order.number}</strong>
      </p>
      <dl className={styles.facts}>
        <div>
          <dt>Status</dt>
          <dd data-testid="order-status">{order.status}</dd>
        </div>
        <div>
          <dt>Placed on</dt>
          <dd>{formatDate(order.createdAt)}</dd>
        </div>
        <div>
          <dt>Preferred delivery</dt>
          <dd data-testid="order-delivery-date">
            {shortDate(order.deliveryDate)} ({order.shippingMethod === 'express' ? 'Express' : 'Standard'})
          </dd>
        </div>
        <div>
          <dt>Payment</dt>
          <dd>Card ending {order.paymentLast4}</dd>
        </div>
      </dl>

      <div className={styles.columns}>
        <section aria-labelledby="order-items-heading">
          <h2 id="order-items-heading" className={styles.heading}>
            Items
          </h2>
          <ul className={styles.items} data-testid="order-items">
            {order.items.map((item) => (
              <li key={`${item.productId}:${item.variantId ?? 0}`} className={styles.item}>
                <span>
                  {item.quantity} × {item.name}
                  {item.variantLabel ? ` (${item.variantLabel})` : ''}
                </span>
                <span>{formatPrice(item.lineTotalCents)}</span>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="order-ship-heading">
          <h2 id="order-ship-heading" className={styles.heading}>
            Shipping to
          </h2>
          <address className={styles.address}>
            {address.firstName} {address.lastName}
            <br />
            {address.street}
            <br />
            {[address.city, `${address.regionName} ${address.postalCode}`].filter(Boolean).join(', ')}
            <br />
            {address.countryName}
            <br />
            {address.phone}
          </address>
        </section>
      </div>

      <section aria-labelledby="order-totals-heading" className={styles.totals}>
        <h2 id="order-totals-heading" className={styles.heading}>
          Totals
        </h2>
        <Totals
          testIdPrefix="order"
          coupon={coupon}
          totals={{
            subtotalCents: order.subtotalCents,
            discountCents: order.discountCents,
            shippingMethod: order.shippingMethod,
            shippingCents: order.shippingCents,
            taxCents: order.taxCents,
            totalCents: order.totalCents,
          }}
        />
      </section>

      <p className={styles.actions}>
        <Link to="/products" className="btn btn-primary">
          Continue shopping
        </Link>
      </p>
    </section>
  );
}
