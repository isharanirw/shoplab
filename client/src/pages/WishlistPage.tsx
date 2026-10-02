import { useEffect, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiRequestError } from '../api/client';
import type { ListResponse, ProductSummary } from '../api/types';
import { useCart } from '../cart/CartContext';
import { ErrorState, Spinner } from '../components/Feedback';
import { Price } from '../components/Price';
import { ProductImage } from '../components/ProductImage';
import { ProductGridSkeleton } from '../components/ProductGrid';
import { StarRating } from '../components/StarRating';
import { StockBadge } from '../components/StockBadge';
import { useFetch } from '../hooks/useFetch';
import { moveAnnouncement, moveItem } from '../lib/reorder';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import { useWishlist } from '../wishlist/WishlistContext';
import styles from './WishlistPage.module.css';

interface WishlistEntry extends ProductSummary {
  position: number;
}

interface Notice {
  text: string;
  /** Show a "View cart" link after the text. */
  cartLink?: boolean;
}

/**
 * /wishlist: the saved products in the user's own order. Reorder by dragging a row (native HTML5 drag and
 * drop) or with the Move up / Move down buttons; every change is saved with PUT /api/wishlist/order.
 */
export function WishlistPage() {
  useDocumentTitle('My wishlist');
  const result = useFetch<ListResponse<WishlistEntry>>('/api/wishlist');
  const wishlist = useWishlist();
  const cart = useCart();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [items, setItems] = useState<WishlistEntry[]>([]);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [dragId, setDragId] = useState<number | null>(null);
  const [overId, setOverId] = useState<number | null>(null);
  // The dragged ID is also kept in a ref so drag events that arrive before React re-renders still see it.
  const dragRef = useRef<number | null>(null);
  const saveChain = useRef<Promise<unknown>>(Promise.resolve());
  const focusAfterMove = useRef<{ id: number; direction: 'up' | 'down' } | null>(null);

  useEffect(() => {
    if (result.status === 'success') setItems(result.data.data);
  }, [result.status, result.data]);

  // After a keyboard move the list re-renders in a new order; put focus back on the same item's button.
  useEffect(() => {
    const target = focusAfterMove.current;
    if (!target) return;
    focusAfterMove.current = null;
    const wanted = document.querySelector<HTMLButtonElement>(`[data-testid="wishlist-move-${target.direction}-${target.id}"]`);
    const other = document.querySelector<HTMLButtonElement>(`[data-testid="wishlist-move-${target.direction === 'up' ? 'down' : 'up'}-${target.id}"]`);
    (wanted && !wanted.disabled ? wanted : other)?.focus();
  }, [items]);

  /** Saves the order. Requests are chained so the last move always wins; a failure puts the server's order back. */
  function persist(ids: number[]) {
    saveChain.current = saveChain.current
      .then(() => api<ListResponse<WishlistEntry>>('/api/wishlist/order', { method: 'PUT', body: { productIds: ids } }))
      .catch((err: unknown) => {
        setError(err instanceof ApiRequestError ? err.message : 'Could not save the new order. Please try again.');
        result.retry();
      });
  }

  function moveTo(id: number, toIndex: number, keyboardDirection?: 'up' | 'down') {
    const from = items.findIndex((p) => p.id === id);
    if (from === -1 || toIndex === from) return;
    const next = moveItem(items, from, toIndex);
    setItems(next);
    setError(null);
    const moved = next[toIndex];
    if (moved) setNotice({ text: moveAnnouncement(moved.name, toIndex + 1, next.length) });
    if (keyboardDirection) focusAfterMove.current = { id, direction: keyboardDirection };
    persist(next.map((p) => p.id));
  }

  function onDragStart(event: DragEvent<HTMLLIElement>, id: number) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(id));
    dragRef.current = id;
    setDragId(id);
  }

  function onDragOver(event: DragEvent<HTMLLIElement>, id: number) {
    if (dragRef.current === null) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (overId !== id) setOverId(id);
  }

  function onDrop(event: DragEvent<HTMLLIElement>, id: number) {
    event.preventDefault();
    const sourceId = dragRef.current ?? Number(event.dataTransfer.getData('text/plain'));
    dragRef.current = null;
    setDragId(null);
    setOverId(null);
    const toIndex = items.findIndex((p) => p.id === id);
    if (Number.isInteger(sourceId) && toIndex !== -1) moveTo(sourceId, toIndex);
  }

  function endDrag() {
    dragRef.current = null;
    setDragId(null);
    setOverId(null);
  }

  async function handleRemove(product: ProductSummary) {
    setBusyId(product.id);
    setError(null);
    try {
      await wishlist.remove(product.id);
      setItems((list) => list.filter((p) => p.id !== product.id));
      setNotice({ text: `Removed ${product.name} from your wishlist.` });
      headingRef.current?.focus();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not remove that item. Please try again.');
    } finally {
      setBusyId(null);
    }
  }

  /** Adds one unit through the real cart API, then takes the product off the wishlist (it moved, it is not copied). */
  async function handleMoveToCart(product: ProductSummary) {
    setBusyId(product.id);
    setError(null);
    try {
      await cart.addItem({ productId: product.id, variantId: null, quantity: 1 }, product.stock);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add that to your cart.');
      setBusyId(null);
      return;
    }
    try {
      await wishlist.remove(product.id);
      setItems((list) => list.filter((p) => p.id !== product.id));
      setNotice({ text: `Moved ${product.name} to your cart.`, cartLink: true });
      headingRef.current?.focus();
    } catch {
      setNotice({ text: `Added ${product.name} to your cart, but it could not be removed from your wishlist.`, cartLink: true });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section aria-labelledby="wishlist-heading">
      <h1 id="wishlist-heading" ref={headingRef} tabIndex={-1} className={styles.heading}>
        My wishlist
      </h1>
      <div role="status" aria-live="polite" className={styles.message} data-testid="wishlist-status">
        {notice && (
          <>
            {notice.text}
            {notice.cartLink && (
              <>
                {' '}
                <Link to="/cart">View cart</Link>
              </>
            )}
          </>
        )}
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
          <p id="wishlist-reorder-help" className={styles.help}>
            Drag an item to a new place, or use its Move up and Move down buttons. Your order is saved automatically.
          </p>
          <ol className={styles.list} aria-describedby="wishlist-reorder-help" data-testid="wishlist-list">
            {items.map((p, index) => {
              const classes = [styles.item];
              if (dragId === p.id) classes.push(styles.dragging);
              if (overId === p.id && dragId !== p.id) classes.push(styles.dropTarget);
              const canMoveToCart = p.inStock && !p.hasVariants;
              const reasonId = `wishlist-cart-reason-${p.id}`;
              return (
                <li
                  key={p.id}
                  className={classes.join(' ')}
                  draggable
                  onDragStart={(e) => onDragStart(e, p.id)}
                  onDragEnter={(e) => onDragOver(e, p.id)}
                  onDragOver={(e) => onDragOver(e, p.id)}
                  onDragLeave={() => setOverId((current) => (current === p.id ? null : current))}
                  onDrop={(e) => onDrop(e, p.id)}
                  onDragEnd={endDrag}
                  data-testid={`wishlist-item-${p.id}`}
                  data-position={index + 1}
                >
                  <span className={styles.handle} aria-hidden="true" title="Drag to reorder">
                    ⋮⋮
                  </span>
                  <Link to={`/products/${p.id}`} className={styles.thumb} tabIndex={-1} aria-hidden="true" draggable={false}>
                    <ProductImage productId={p.id} name={p.name} imagePath={p.imagePath} decorative />
                  </Link>
                  <div className={styles.info}>
                    <h2 className={styles.name}>
                      <Link to={`/products/${p.id}`} draggable={false}>
                        {p.name}
                      </Link>
                    </h2>
                    <p className={styles.meta}>{p.category}</p>
                    <p className={styles.meta}>
                      <Price priceCents={p.priceCents} salePriceCents={p.salePriceCents} />
                    </p>
                    <p className={styles.meta}>
                      <StarRating rating={p.rating} /> <StockBadge stock={p.stock} />
                    </p>
                  </div>
                  <div className={styles.actions}>
                    <div className={styles.moveButtons}>
                      <button
                        type="button"
                        className="btn btn-small"
                        disabled={index === 0}
                        aria-label={`Move ${p.name} up`}
                        onClick={() => moveTo(p.id, index - 1, 'up')}
                        data-testid={`wishlist-move-up-${p.id}`}
                      >
                        <span aria-hidden="true">↑</span> Move up
                      </button>
                      <button
                        type="button"
                        className="btn btn-small"
                        disabled={index === items.length - 1}
                        aria-label={`Move ${p.name} down`}
                        onClick={() => moveTo(p.id, index + 1, 'down')}
                        data-testid={`wishlist-move-down-${p.id}`}
                      >
                        <span aria-hidden="true">↓</span> Move down
                      </button>
                    </div>
                    {canMoveToCart ? (
                      <button
                        type="button"
                        className="btn btn-small btn-primary"
                        disabled={busyId === p.id}
                        aria-label={`Move ${p.name} to cart`}
                        onClick={() => void handleMoveToCart(p)}
                        data-testid={`wishlist-move-to-cart-${p.id}`}
                      >
                        Move to cart
                      </button>
                    ) : p.hasVariants && p.inStock ? (
                      <Link to={`/products/${p.id}`} className="btn btn-small btn-primary" data-testid={`wishlist-choose-options-${p.id}`}>
                        Choose options<span className="visually-hidden"> for {p.name}</span>
                      </Link>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="btn btn-small btn-primary"
                          disabled
                          aria-label={`Move ${p.name} to cart`}
                          aria-describedby={reasonId}
                          data-testid={`wishlist-move-to-cart-${p.id}`}
                        >
                          Move to cart
                        </button>
                        <span id={reasonId} className={styles.reason}>
                          Out of stock
                        </span>
                      </>
                    )}
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
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </section>
  );
}
