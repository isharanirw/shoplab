import { Link } from 'react-router-dom';
import type { ProductDetail } from '../api/types';
import { useFetch } from '../hooks/useFetch';
import { ErrorState, Spinner } from './Feedback';
import { Modal } from './Modal';
import { Price } from './Price';
import { ProductImage } from './ProductImage';
import { PurchasePanel } from './PurchasePanel';
import { StarRating } from './StarRating';
import styles from './QuickView.module.css';

interface QuickViewProps {
  productId: number;
  productName: string;
  onClose: () => void;
}

/** A dialog with the essentials of one product, loaded from the same endpoint as the detail page. */
export function QuickView({ productId, productName, onClose }: QuickViewProps) {
  const result = useFetch<ProductDetail>(`/api/products/${productId}`);
  const titleId = 'quick-view-title';

  return (
    <Modal labelledBy={titleId} onClose={onClose}>
      <button type="button" className={`btn btn-small ${styles.close}`} aria-label="Close quick view" onClick={onClose} data-testid="quick-view-close">
        <span aria-hidden="true">✕</span>
      </button>
      {result.status === 'loading' && (
        <>
          <h2 id={titleId} className="visually-hidden">
            Quick view: {productName}
          </h2>
          <Spinner label="Loading product" />
        </>
      )}
      {result.status === 'error' && (
        <>
          <h2 id={titleId} className="visually-hidden">
            Quick view: {productName}
          </h2>
          <ErrorState message={result.error.message} onRetry={result.retry} />
        </>
      )}
      {result.status === 'success' && (
        <div className={styles.layout} data-testid="quick-view">
          <div className={styles.image}>
            <ProductImage productId={result.data.id} name={result.data.name} />
          </div>
          <div className={styles.info}>
            <h2 id={titleId} className={styles.title}>
              {result.data.name}
            </h2>
            <p className={styles.row}>
              <Price priceCents={result.data.priceCents} salePriceCents={result.data.salePriceCents} />
            </p>
            <p className={styles.row}>
              <StarRating rating={result.data.rating} />
            </p>
            <p className={styles.description}>{result.data.description}</p>
            <PurchasePanel product={result.data} idPrefix="qv" />
            <p className={styles.row}>
              <Link to={`/products/${result.data.id}`}>View full details</Link>
            </p>
          </div>
        </div>
      )}
    </Modal>
  );
}
