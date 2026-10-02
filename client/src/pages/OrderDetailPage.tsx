import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ApiRequestError } from '../api/client';
import type { CartCoupon, Order } from '../api/types';
import { ConfirmModal } from '../components/ConfirmModal';
import { ErrorState, Spinner } from '../components/Feedback';
import { OrderStatusBadge } from '../components/OrderStatusBadge';
import { Totals } from '../components/Totals';
import { useFetch } from '../hooks/useFetch';
import { shortDate } from '../lib/delivery';
import { formatDate, formatPrice } from '../lib/format';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import styles from './OrderConfirmationPage.module.css';
import orderStyles from './Orders.module.css';

/** /account/orders/:id: one order in full, with Cancel order while it is still Processing. */
export function OrderDetailPage() {
  const { id } = useParams();
  const validId = id !== undefined && /^[1-9]\d{0,8}$/.test(id);
  const result = useFetch<Order>(validId ? `/api/orders/${id}` : null);
  useDocumentTitle('Order details');

  if (!validId || (result.status === 'error' && (result.error.status === 404 || result.error.status === 400))) {
    return (
      <section aria-labelledby="order-heading" data-testid="order-not-found">
        <h1 id="order-heading">Order not found</h1>
        <p>We could not find that order in your account.</p>
        <p>
          <Link to="/account/orders">Back to order history</Link>
        </p>
      </section>
    );
  }
  if (result.status === 'loading') {
    return (
      <section aria-labelledby="order-heading">
        <h1 id="order-heading" className="visually-hidden">
          Order details
        </h1>
        <Spinner label="Loading your order" />
      </section>
    );
  }
  if (result.status === 'error') {
    return (
      <section aria-labelledby="order-heading">
        <h1 id="order-heading" className="visually-hidden">
          Order details
        </h1>
        <ErrorState message={result.error.message} onRetry={result.retry} />
      </section>
    );
  }
  return <OrderDetail key={result.data.id} initial={result.data} />;
}

function OrderDetail({ initial }: { initial: Order }) {
  const [order, setOrder] = useState(initial);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  useDocumentTitle(`Order ${order.number}`);

  useEffect(() => {
    setOrder(initial);
  }, [initial]);

  async function cancel() {
    setBusy(true);
    setCancelError(null);
    try {
      const updated = await api<Order>(`/api/orders/${order.id}/cancel`, { method: 'POST' });
      setOrder(updated);
      setConfirming(false);
      setNotice(`Order ${updated.number} was cancelled and the items went back into stock.`);
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 409) {
        // Someone (or something) already moved the order on; show what it is now.
        try {
          setOrder(await api<Order>(`/api/orders/${order.id}`));
        } catch {
          // keep the old view; the message below still explains
        }
      }
      setCancelError(err instanceof ApiRequestError ? err.message : 'Could not cancel the order. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const coupon: CartCoupon | null = order.couponCode
    ? { code: order.couponCode, description: '', applied: true, reason: null, message: null }
    : null;
  const address = order.address;
  const canCancel = order.status === 'Processing';

  return (
    <section aria-labelledby="order-heading" className={styles.page} data-testid="order-detail">
      <nav aria-label="Breadcrumb" className={orderStyles.breadcrumb}>
        <Link to="/account">My account</Link> / <Link to="/account/orders">Order history</Link> / {order.number}
      </nav>
      <h1 id="order-heading">
        Order <span data-testid="order-number">{order.number}</span>
      </h1>

      <div role="status" aria-live="polite">
        {notice && (
          <p className={orderStyles.success} data-testid="order-notice">
            {notice}
          </p>
        )}
      </div>

      <dl className={styles.facts}>
        <div>
          <dt>Status</dt>
          <dd>
            <OrderStatusBadge status={order.status} />
          </dd>
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

      {canCancel && (
        <p>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setCancelError(null);
              setNotice(null);
              setConfirming(true);
            }}
            data-testid="cancel-order"
          >
            Cancel order
          </button>
        </p>
      )}
      {!canCancel && order.status !== 'Cancelled' && <p className={orderStyles.hint}>Only orders that are still Processing can be cancelled.</p>}
      {cancelError && !confirming && (
        <p role="alert" className={orderStyles.problem}>
          {cancelError}
        </p>
      )}

      <div className={styles.columns}>
        <section aria-labelledby="order-items-heading">
          <h2 id="order-items-heading" className={styles.heading}>
            Items
          </h2>
          <ul className={styles.items} data-testid="order-items">
            {order.items.map((item) => (
              <li key={`${item.productId}:${item.variantId ?? 0}`} className={styles.item}>
                <span>
                  {item.quantity} ×{' '}
                  <Link to={`/products/${item.productId}`}>
                    {item.name}
                    {item.variantLabel ? ` (${item.variantLabel})` : ''}
                  </Link>
                  {order.status !== 'Cancelled' && (
                    <>
                      {' '}
                      <Link to={`/products/${item.productId}#reviews`} className={orderStyles.reviewLink}>
                        Write a review<span className="visually-hidden"> for {item.name}</span>
                      </Link>
                    </>
                  )}
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
        <Link to="/account/orders" className="btn">
          Back to order history
        </Link>
      </p>

      {confirming && (
        <ConfirmModal
          idPrefix="cancel-order"
          title="Cancel this order?"
          confirmLabel="Cancel order"
          cancelLabel="Keep order"
          busy={busy}
          error={cancelError}
          onConfirm={() => void cancel()}
          onCancel={() => setConfirming(false)}
        >
          <p>
            Order <strong>{order.number}</strong> ({formatPrice(order.totalCents)}) will be cancelled and its items go back into stock. This cannot be
            undone.
          </p>
        </ConfirmModal>
      )}
    </section>
  );
}
