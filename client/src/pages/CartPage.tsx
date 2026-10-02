import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiRequestError } from '../api/client';
import type { Cart, CartItem } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { useCart } from '../cart/CartContext';
import { useGuestCart } from '../cart/useGuestCart';
import { CartContent } from '../components/CartContent';
import type { CouponFeedback } from '../components/CartContent';
import { ErrorState, Spinner } from '../components/Feedback';
import { lineKey, removeGuestLine, setGuestQuantity } from '../lib/cart';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import styles from './CartPage.module.css';
import { useToast } from '../components/Toasts';
import { failureOf, isTransientError } from '../lib/failure';
import type { Failure } from '../lib/failure';

export function CartPage() {
  useDocumentTitle('Your cart');
  const { user, loading } = useAuth();
  const cart = useCart();

  return (
    <section aria-labelledby="cart-heading">
      <h1 id="cart-heading">Your cart</h1>
      {cart.mergeNotice && (
        <div role="status" className={styles.mergeNotice} data-testid="merge-notice">
          <p>Your guest cart was added to your account. Some items were changed:</p>
          <ul>
            {cart.mergeNotice.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <button type="button" className="btn btn-small" onClick={cart.dismissMergeNotice}>
            Dismiss
          </button>
        </div>
      )}
      {loading ? <Spinner label="Loading your cart" /> : user ? <ServerCart /> : <GuestCart />}
    </section>
  );
}

function EmptyCart() {
  return (
    <div className={styles.empty} data-testid="cart-empty">
      <p className={styles.emptyTitle}>Your cart is empty.</p>
      <p>Add something from the catalogue and it will show up here.</p>
      <Link to="/products" className="btn btn-primary">
        Browse products
      </Link>
    </div>
  );
}

function messageOf(err: unknown): string {
  return err instanceof ApiRequestError ? err.message : 'Something went wrong. Please try again.';
}

type ServerState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; cart: Cart };

/** The cart of a logged-in user, kept on the server. */
function ServerCart() {
  const cartCtx = useCart();
  const { setServerCart, version, syncing } = cartCtx;
  const [state, setState] = useState<ServerState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<Failure | null>(null);
  const toast = useToast();

  useEffect(() => {
    if (syncing) return;
    const controller = new AbortController();
    setState({ status: 'loading' });
    api<Cart>('/api/cart', { signal: controller.signal })
      .then((cart) => {
        if (controller.signal.aborted) return;
        setState({ status: 'ready', cart });
        setServerCart(cart);
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setState({ status: 'error', message: messageOf(err) });
      });
    return () => controller.abort();
  }, [version, attempt, syncing, setServerCart]);

  const change = useCallback(
    async (run: () => Promise<Cart>, success: string | null): Promise<boolean> => {
      setBusy(true);
      setError(null);
      try {
        const cart = await run();
        setState({ status: 'ready', cart });
        setServerCart(cart);
        setMessage(success);
        return true;
      } catch (err) {
        setError(failureOf(err, 'Something went wrong. Please try again.', () => void change(run, success)));
        setMessage(null);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [setServerCart],
  );

  if (state.status === 'loading' || syncing) return <Spinner label="Loading your cart" />;
  if (state.status === 'error') return <ErrorState message={state.message} onRetry={() => setAttempt((n) => n + 1)} />;
  const cart = state.cart;
  if (cart.items.length === 0) {
    return (
      <>
        <div role="status" className={styles.srOnly}>
          {message}
        </div>
        <EmptyCart />
      </>
    );
  }

  return (
    <CartContent
      items={cart.items}
      guest={false}
      subtotalCents={cart.totals.subtotalCents}
      totals={cart.totals}
      coupon={cart.coupon}
      busy={busy}
      message={message}
      error={error}
      onQuantity={(item, quantity) => {
        void change(() => api<Cart>(`/api/cart/items/${item.id}`, { method: 'PATCH', body: { quantity } }), `Quantity of ${item.name} is now ${quantity}.`);
      }}
      onRemove={(item) => {
        // The Remove button uses the browser's native confirm dialog (Clear cart uses a custom modal).
        if (!window.confirm(`Remove ${item.name} from your cart?`)) return;
        void change(() => api<Cart>(`/api/cart/items/${item.id}`, { method: 'DELETE' }), `Removed ${item.name} from your cart.`);
      }}
      onClear={async () => {
        await change(() => api<Cart>('/api/cart', { method: 'DELETE' }), 'Your cart was cleared.');
      }}
      onApplyCoupon={async (code): Promise<CouponFeedback> => {
        const trimmed = code.trim();
        if (trimmed === '') return { kind: 'error', text: 'Enter a coupon code.' };
        try {
          const next = await api<Cart>('/api/cart/coupon', { method: 'POST', body: { code: trimmed } });
          setState({ status: 'ready', cart: next });
          setServerCart(next);
          const applied = next.coupon;
          toast.success('Coupon applied');
          return { kind: 'success', text: applied ? `Coupon ${applied.code} applied: ${applied.description}.` : 'Coupon applied.' };
        } catch (err) {
          return { kind: 'error', text: messageOf(err), transient: isTransientError(err) };
        }
      }}
      onRemoveCoupon={async () => {
        await change(() => api<Cart>('/api/cart/coupon', { method: 'DELETE' }), null);
      }}
    />
  );
}

/** The cart of someone who is not logged in. It lives in localStorage and shows the subtotal only. */
function GuestCart() {
  const cartCtx = useCart();
  const { guestLines, setGuestLines } = cartCtx;
  const view = useGuestCart(guestLines);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<Failure | null>(null);

  // Products that no longer exist are dropped from the stored cart.
  useEffect(() => {
    if (view.gone.length === 0) return;
    const goneKeys = new Set(view.gone.map(lineKey));
    setGuestLines(guestLines.filter((l) => !goneKeys.has(lineKey(l))));
  }, [view.gone, guestLines, setGuestLines]);

  if (guestLines.length === 0) return <EmptyCart />;
  if (view.status === 'loading') return <Spinner label="Loading your cart" />;
  if (view.status === 'error') return <ErrorState message={view.errorMessage ?? 'Could not load your cart.'} onRetry={view.retry} />;
  if (view.items.length === 0) return <EmptyCart />;

  return (
    <CartContent
      items={view.items}
      guest
      subtotalCents={view.subtotalCents}
      totals={null}
      coupon={null}
      busy={false}
      message={message}
      error={error}
      onQuantity={(item: CartItem, quantity) => {
        const result = setGuestQuantity(guestLines, lineKey(item), quantity, item.stock);
        if (result.error) {
          setError({ message: result.error });
          setMessage(null);
          return;
        }
        setError(null);
        setGuestLines(result.lines);
        setMessage(`Quantity of ${item.name} is now ${quantity}.`);
      }}
      onRemove={(item) => {
        if (!window.confirm(`Remove ${item.name} from your cart?`)) return;
        setGuestLines(removeGuestLine(guestLines, lineKey(item)));
        setError(null);
        setMessage(`Removed ${item.name} from your cart.`);
      }}
      onClear={() => {
        setGuestLines([]);
        return Promise.resolve();
      }}
      onApplyCoupon={() => Promise.resolve({ kind: 'error', text: 'Log in to apply a coupon.' })}
      onRemoveCoupon={() => Promise.resolve()}
    />
  );
}
