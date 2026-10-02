import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { loginPathFor } from '../lib/navigation';
import { useWishlist } from './WishlistContext';
import styles from './WishlistButton.module.css';
import { ActionError } from '../components/ActionError';
import { useToast } from '../components/Toasts';
import { failureOf } from '../lib/failure';
import type { Failure } from '../lib/failure';

interface WishlistButtonProps {
  productId: number;
  productName: string;
}

/**
 * The heart on a product card. Logged-in users add or remove the product; logged-out users are
 * sent to /login?next=<this page> and come back afterwards.
 */
export function WishlistButton({ productId, productName }: WishlistButtonProps) {
  const { user, loading } = useAuth();
  const wishlist = useWishlist();
  const navigate = useNavigate();
  const location = useLocation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Failure | null>(null);
  const toast = useToast();
  const saved = wishlist.has(productId);

  async function handleClick() {
    if (loading || busy) return;
    if (!user) {
      navigate(loginPathFor(location.pathname + location.search));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (saved) await wishlist.remove(productId);
      else await wishlist.add(productId);
      toast.success(saved ? 'Removed from wishlist' : 'Saved to wishlist');
    } catch (err) {
      setError(failureOf(err, 'Could not update your wishlist.', () => void handleClick()));
      toast.error('Could not update wishlist');
    } finally {
      setBusy(false);
    }
  }

  const label = saved ? `Remove from wishlist: ${productName}` : `Add to wishlist: ${productName}`;
  return (
    <>
      <button
        type="button"
        className={`${styles.heart} ${saved ? styles.heartOn : ''}`}
        aria-label={label}
        aria-busy={busy || undefined}
        onClick={() => void handleClick()}
        data-testid={`wishlist-heart-${productId}`}
      >
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
          <path
            d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.6 4.5 6.3 4.5c2.1 0 3.8 1.2 5.7 3.4 1.9-2.2 3.6-3.4 5.7-3.4 3.7 0 5.4 3.9 3.9 7.3C19.5 16.4 12 21 12 21z"
            fill={saved ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {error && <ActionError failure={error} className={styles.error} />}
    </>
  );
}
