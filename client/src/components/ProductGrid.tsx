import { useState } from 'react';
import type { ReactNode } from 'react';
import type { ProductSummary } from '../api/types';
import { ProductCard } from './ProductCard';
import { QuickView } from './QuickView';
import styles from './ProductGrid.module.css';

interface ProductGridProps {
  products: ProductSummary[];
  showWishlistButton?: boolean;
  /** Renders extra controls under each card (the wishlist page puts Remove here). */
  renderExtra?: (product: ProductSummary) => ReactNode;
}

/** A responsive grid of cards that also owns the quick view dialog. */
export function ProductGrid({ products, showWishlistButton = true, renderExtra }: ProductGridProps) {
  const [quickView, setQuickView] = useState<ProductSummary | null>(null);
  return (
    <>
      <ul className={styles.grid} data-testid="product-grid">
        {products.map((p) => (
          <li key={p.id} className={styles.item}>
            <ProductCard product={p} onQuickView={setQuickView} showWishlistButton={showWishlistButton} />
            {renderExtra?.(p)}
          </li>
        ))}
      </ul>
      {quickView && <QuickView productId={quickView.id} productName={quickView.name} onClose={() => setQuickView(null)} />}
    </>
  );
}

export function ProductGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <ul className={styles.grid} aria-hidden="true" data-testid="product-grid-skeleton">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className={styles.skeletonItem} />
      ))}
    </ul>
  );
}
