import { formatPrice } from '../lib/format';
import styles from './ProductParts.module.css';

interface PriceProps {
  priceCents: number;
  salePriceCents: number | null;
}

/** The sale price in bold with the original price struck through, or just the price. */
export function Price({ priceCents, salePriceCents }: PriceProps) {
  if (salePriceCents === null) {
    return (
      <span className={styles.price} data-testid="price">
        {formatPrice(priceCents)}
      </span>
    );
  }
  return (
    <span className={styles.price} data-testid="price">
      <span className="visually-hidden">Sale price </span>
      <span className={styles.salePrice} data-testid="sale-price">
        {formatPrice(salePriceCents)}
      </span>{' '}
      <span className="visually-hidden">, was </span>
      <del className={styles.originalPrice} data-testid="original-price">
        {formatPrice(priceCents)}
      </del>
    </span>
  );
}
