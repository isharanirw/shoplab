import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiRequestError } from '../api/client';
import type { ListResponse, ProductSummary } from '../api/types';
import { ErrorState, Spinner } from '../components/Feedback';
import { ProductGrid, ProductGridSkeleton } from '../components/ProductGrid';
import { useFetch } from '../hooks/useFetch';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import { useWishlist } from '../wishlist/WishlistContext';
import styles from './WishlistPage.module.css';

interface WishlistEntry extends ProductSummary {
  position: number;
}

export function WishlistPage() {
  useDocumentTitle('My wishlist');
  const result = useFetch<ListResponse<WishlistEntry>>('/api/wishlist');
  const wishlist = useWishlist();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [removedIds, setRemovedIds] = useState<number[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function handleRemove(product: ProductSummary) {
    setBusyId(product.id);
    setError(null);
    try {
      await wishlist.remove(product.id);
      setRemovedIds((ids) => [...ids, product.id]);
      setMessage(`Removed ${product.name} from your wishlist.`);
      headingRef.current?.focus();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not remove that item. Please try again.');
    } finally {
      setBusyId(null);
    }
  }

  const items = result.status === 'success' ? result.data.data.filter((p) => !removedIds.includes(p.id)) : [];

  return (
    <section aria-labelledby="wishlist-heading">
      <h1 id="wishlist-heading" ref={headingRef} tabIndex={-1} className={styles.heading}>
        My wishlist
      </h1>
      <div role="status" className={styles.message}>
        {message}
      </div>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}

      {result.status === 'loading' && (
        <>
          <Spinner label="Loading your wishlist" />
          <ProductGridSkeleton count={4} />
        </>
      )}
      {result.status === 'error' && <ErrorState message={result.error.message} onRetry={result.retry} />}
      {result.status === 'success' && items.length === 0 && (
        <div className={styles.empty} data-testid="wishlist-empty">
          <h2>Your wishlist is empty</h2>
          <p>Use the heart on a product to save it here.</p>
          <Link to="/products" className="btn btn-primary">
            Browse products
          </Link>
        </div>
      )}
      {result.status === 'success' && items.length > 0 && (
        <>
          <p data-testid="wishlist-count">{items.length === 1 ? '1 item' : `${items.length} items`}</p>
          <ProductGrid
            products={items}
            showWishlistButton={false}
            renderExtra={(p) => (
              <button
                type="button"
                className="btn btn-small"
                disabled={busyId === p.id}
                aria-label={`Remove ${p.name} from wishlist`}
                onClick={() => void handleRemove(p)}
                data-testid={`wishlist-remove-${p.id}`}
              >
                Remove
              </button>
            )}
          />
        </>
      )}
    </section>
  );
}
