import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { CartItem } from '../api/types';
import { formatPrice } from '../lib/format';
import { clampQuantity } from '../lib/variants';
import { Price } from './Price';
import { ProductImage } from './ProductImage';
import styles from './CartLineItem.module.css';

interface CartLineItemProps {
  item: CartItem;
  busy: boolean;
  onQuantity: (item: CartItem, quantity: number) => void;
  onRemove: (item: CartItem) => void;
}

/** One cart line: product, price, quantity (typed or with the stepper), line total and Remove. */
export function CartLineItem({ item, busy, onQuantity, onRemove }: CartLineItemProps) {
  const [text, setText] = useState(String(item.quantity));
  const [limitNote, setLimitNote] = useState<string | null>(null);
  const max = item.maxQuantity;
  const inputId = `cart-quantity-${item.productId}-${item.variantId ?? 0}`;
  const labelText = `Quantity for ${item.name}${item.variantLabel ? ` (${item.variantLabel})` : ''}`;
  const overStock = item.stock < item.quantity;

  useEffect(() => {
    setText(String(item.quantity));
  }, [item.quantity]);

  function commit(raw: string) {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isNaN(parsed) || max === 0) {
      setText(String(item.quantity));
      return;
    }
    const next = clampQuantity(parsed, max);
    setLimitNote(
      next !== parsed ? (parsed > max ? `Only ${max} can be ordered, so the quantity was set to ${max}.` : `The smallest quantity is 1.`) : null,
    );
    setText(String(next));
    if (next !== item.quantity) onQuantity(item, next);
  }

  function step(delta: number) {
    setLimitNote(null);
    const next = clampQuantity(item.quantity + delta, max);
    setText(String(next));
    if (next !== item.quantity) onQuantity(item, next);
  }

  const titleId = `cart-line-${item.id}-name`;
  return (
    <li className={styles.line} data-testid={`cart-item-${item.productId}`} aria-labelledby={titleId}>
      <div className={styles.image}>
        <ProductImage productId={item.productId} name={item.name} imagePath={item.imagePath} decorative />
      </div>
      <div className={styles.info}>
        <h2 id={titleId} className={styles.name}>
          <Link to={`/products/${item.productId}`}>{item.name}</Link>
        </h2>
        {item.variantLabel && <p className={styles.variant}>{item.variantLabel}</p>}
        <p className={styles.price}>
          <Price priceCents={item.regularPriceCents} salePriceCents={item.onSale ? item.unitPriceCents : null} />
        </p>
        {!item.inStock && (
          <p className={styles.warn} role="alert">
            This item is out of stock. Remove it to continue.
          </p>
        )}
        {item.inStock && overStock && (
          <p className={styles.warn} role="alert">
            Only {item.stock} in stock. Lower the quantity to continue.
          </p>
        )}
      </div>
      <div className={styles.quantity}>
        <label htmlFor={inputId} className={styles.quantityLabel}>
          <span className="visually-hidden">{labelText}</span>
          <span aria-hidden="true">Qty</span>
        </label>
        <div className={styles.stepper} role="group" aria-label={`${labelText} stepper`}>
          <button
            type="button"
            className="btn btn-small"
            aria-label={`Decrease quantity of ${item.name}`}
            disabled={busy || max === 0 || item.quantity <= 1}
            onClick={() => step(-1)}
            data-testid={`cart-decrease-${item.productId}`}
          >
            <span aria-hidden="true">−</span>
          </button>
          <input
            id={inputId}
            type="number"
            inputMode="numeric"
            min={1}
            max={max || 1}
            className={`control ${styles.qtyInput}`}
            value={text}
            disabled={busy || max === 0}
            onChange={(e) => setText(e.target.value)}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commit(e.currentTarget.value);
              }
            }}
            data-testid={`cart-quantity-${item.productId}`}
          />
          <button
            type="button"
            className="btn btn-small"
            aria-label={`Increase quantity of ${item.name}`}
            disabled={busy || max === 0 || item.quantity >= max}
            onClick={() => step(1)}
            data-testid={`cart-increase-${item.productId}`}
          >
            <span aria-hidden="true">+</span>
          </button>
        </div>
        {limitNote && (
          <p className={styles.note} role="status">
            {limitNote}
          </p>
        )}
      </div>
      <p className={styles.lineTotal} data-testid={`cart-line-total-${item.productId}`}>
        <span className="visually-hidden">Line total </span>
        {formatPrice(item.lineTotalCents)}
      </p>
      <div className={styles.remove}>
        <button
          type="button"
          className="btn btn-small"
          aria-label={`Remove ${item.name} from cart`}
          disabled={busy}
          onClick={() => onRemove(item)}
          data-testid={`cart-remove-${item.productId}`}
        >
          Remove
        </button>
      </div>
    </li>
  );
}
