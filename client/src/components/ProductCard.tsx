import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { ProductSummary } from '../api/types';
import { useCart } from '../cart/CartContext';
import { WishlistButton } from '../wishlist/WishlistButton';
import { Price } from './Price';
import { ProductImage } from './ProductImage';
import { StarRating } from './StarRating';
import { StockBadge } from './StockBadge';
import styles from './ProductCard.module.css';
import { ActionError } from './ActionError';
import { useToast } from './Toasts';
import { failureOf } from '../lib/failure';
import type { Failure } from '../lib/failure';

interface ProductCardProps {
  product: ProductSummary;
  onQuickView: (product: ProductSummary) => void;
  /** The wishlist page has its own Remove button, so it hides the heart. */
  showWishlistButton?: boolean;
}

export function ProductCard({ product, onQuickView, showWishlistButton = true }: ProductCardProps) {
  const cart = useCart();
  const [notice, setNotice] = useState<string | null>(null);
  const [problem, setProblem] = useState<Failure | null>(null);
  const toast = useToast();
  const nameId = `product-name-${product.id}`;

  async function handleAdd() {
    // A product with sizes or colours needs a choice first, so the quick view takes over.
    if (product.hasVariants) {
      onQuickView(product);
      return;
    }
    setNotice(null);
    setProblem(null);
    try {
      await cart.addItem({ productId: product.id, variantId: null, quantity: 1 }, product.stock);
      setNotice(`Added 1 × ${product.name} to your cart.`);
      toast.success('Added to cart');
    } catch (err) {
      setProblem(failureOf(err, 'Could not add that to your cart.', () => void handleAdd()));
      toast.error('Could not add to cart');
    }
  }

  return (
    <article className={styles.card} data-testid={`product-card-${product.id}`} aria-labelledby={nameId}>
      <Link to={`/products/${product.id}`} className={styles.imageLink} tabIndex={-1} aria-hidden="true">
        <ProductImage productId={product.id} name={product.name} imagePath={product.imagePath} decorative />
      </Link>
      <div className={styles.body}>
        <h3 id={nameId} className={styles.name}>
          <Link to={`/products/${product.id}`}>{product.name}</Link>
        </h3>
        <p className={styles.category}>{product.category}</p>
        <p className={styles.row}>
          <Price priceCents={product.priceCents} salePriceCents={product.salePriceCents} />
        </p>
        <p className={styles.row}>
          <StarRating rating={product.rating} />
        </p>
        <p className={styles.row}>
          <StockBadge stock={product.stock} />
        </p>
      </div>
      <div className={styles.actions}>
        <button type="button" className="btn btn-small" aria-describedby={nameId} onClick={() => onQuickView(product)}>
          Quick view
        </button>
        <button
          type="button"
          className="btn btn-small btn-primary"
          aria-describedby={nameId}
          disabled={!product.inStock}
          onClick={() => void handleAdd()}
        >
          Add to cart
        </button>
        {showWishlistButton && <WishlistButton productId={product.id} productName={product.name} />}
      </div>
      <div role="status" aria-live="polite">
        {notice && (
          <p className={styles.notice}>
            {notice} <Link to="/cart">View cart</Link>
          </p>
        )}
      </div>
      {problem && <ActionError failure={problem} className={styles.problem} />}
    </article>
  );
}
