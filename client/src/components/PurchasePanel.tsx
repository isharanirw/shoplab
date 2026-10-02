import { useEffect, useState } from 'react';
import type { ProductDetail } from '../api/types';
import { addToCart, CART_STUB_MESSAGE } from '../lib/cart';
import { clampQuantity, maxQuantity, optionAvailable, purchaseState, variantAxes } from '../lib/variants';
import type { Selection } from '../lib/variants';
import { StockBadge } from './StockBadge';
import styles from './PurchasePanel.module.css';

const SWATCHES: Record<string, string> = {
  Black: '#111827',
  White: '#ffffff',
  Grey: '#9ca3af',
  Gray: '#9ca3af',
  Blue: '#2563eb',
  Navy: '#1e3a8a',
  Red: '#dc2626',
  Green: '#16a34a',
  Brown: '#78350f',
  Beige: '#d6c3a1',
  Pink: '#f472b6',
  Yellow: '#facc15',
  Orange: '#f97316',
  Purple: '#7c3aed',
  Silver: '#d1d5db',
};

interface PurchasePanelProps {
  product: ProductDetail;
  /** Keeps element IDs unique when two panels could exist on one page. */
  idPrefix: string;
}

/**
 * Size dropdown, colour swatches, quantity stepper and Add to cart for one product. Shared by the
 * detail page and the quick view. The cart itself arrives in Phase 3, so Add to cart calls a stub.
 */
export function PurchasePanel({ product, idPrefix }: PurchasePanelProps) {
  const axes = variantAxes(product.variants);
  const [selection, setSelection] = useState<Selection>({ size: null, colour: null });
  const [quantityText, setQuantityText] = useState('1');
  const [notice, setNotice] = useState<string | null>(null);

  const state = purchaseState(product.stock, product.variants, selection);
  const max = maxQuantity(state.stock);
  const parsed = Number.parseInt(quantityText, 10);
  const quantity = clampQuantity(Number.isNaN(parsed) ? 1 : parsed, max);

  // A different option can have less stock, so pull the quantity back under the new cap.
  useEffect(() => {
    setQuantityText((text) => {
      const n = Number.parseInt(text, 10);
      return !Number.isNaN(n) && n > max && max > 0 ? String(max) : text;
    });
  }, [max]);

  function chooseSize(value: string) {
    setNotice(null);
    setSelection((s) => ({ ...s, size: value === '' ? null : value }));
  }

  function chooseColour(value: string) {
    setNotice(null);
    setSelection((s) => ({ ...s, colour: value }));
  }

  function step(delta: number) {
    setQuantityText(String(clampQuantity(quantity + delta, max)));
  }

  async function handleAdd() {
    if (!state.canAdd) return;
    await addToCart({ productId: product.id, variantId: state.variant?.id ?? null, quantity });
    setNotice(CART_STUB_MESSAGE);
  }

  const sizeId = `${idPrefix}-size`;
  const qtyId = `${idPrefix}-quantity`;
  const reasonId = `${idPrefix}-add-reason`;
  const soldOut = product.stock <= 0;

  return (
    <div className={styles.panel}>
      <div className={styles.stock}>
        <StockBadge stock={state.stock} />
      </div>

      {axes.sizes.length > 0 && (
        <div className={styles.field}>
          <label htmlFor={sizeId} className={styles.label}>
            Size
          </label>
          <select
            id={sizeId}
            className={`control ${styles.select}`}
            value={selection.size ?? ''}
            disabled={soldOut}
            onChange={(e) => chooseSize(e.target.value)}
            data-testid="size-select"
          >
            <option value="">Select a size</option>
            {axes.sizes.map((size) => {
              const available = optionAvailable(product.variants, 'size', size, selection);
              return (
                <option key={size} value={size} disabled={!available}>
                  {available ? size : `${size} (out of stock)`}
                </option>
              );
            })}
          </select>
        </div>
      )}

      {axes.colours.length > 0 && (
        <fieldset className={styles.colours} disabled={soldOut}>
          <legend className={styles.label}>Colour</legend>
          <div className={styles.swatchRow}>
            {axes.colours.map((colour) => {
              const available = optionAvailable(product.variants, 'colour', colour, selection);
              const id = `${idPrefix}-colour-${colour.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
              return (
                <div key={colour} className={styles.swatch}>
                  <input
                    type="radio"
                    id={id}
                    name={`${idPrefix}-colour`}
                    value={colour}
                    className={styles.swatchInput}
                    checked={selection.colour === colour}
                    disabled={!available}
                    onChange={() => chooseColour(colour)}
                  />
                  <label htmlFor={id} className={styles.swatchLabel}>
                    <span className={styles.swatchChip} style={{ background: SWATCHES[colour] ?? '#d1d5db' }} aria-hidden="true" />
                    <span>
                      {colour}
                      {!available && <span className="visually-hidden"> (out of stock)</span>}
                    </span>
                  </label>
                </div>
              );
            })}
          </div>
        </fieldset>
      )}

      <div className={styles.field}>
        <label htmlFor={qtyId} className={styles.label}>
          Quantity
        </label>
        <div className={styles.stepper} role="group" aria-label="Quantity stepper">
          <button
            type="button"
            className="btn btn-small"
            aria-label="Decrease quantity"
            disabled={max === 0 || quantity <= 1}
            onClick={() => step(-1)}
            data-testid="quantity-decrease"
          >
            <span aria-hidden="true">−</span>
          </button>
          <input
            id={qtyId}
            type="number"
            inputMode="numeric"
            className={`control ${styles.qtyInput}`}
            min={1}
            max={max || 1}
            value={max === 0 ? '0' : quantityText}
            disabled={max === 0}
            onChange={(e) => setQuantityText(e.target.value)}
            onBlur={() => setQuantityText(String(quantity))}
            data-testid="quantity-input"
          />
          <button
            type="button"
            className="btn btn-small"
            aria-label="Increase quantity"
            disabled={max === 0 || quantity >= max}
            onClick={() => step(1)}
            data-testid="quantity-increase"
          >
            <span aria-hidden="true">+</span>
          </button>
        </div>
        {max > 0 && <p className={styles.hint}>Up to {max} per order.</p>}
      </div>

      <button
        type="button"
        className="btn btn-primary"
        disabled={!state.canAdd}
        aria-describedby={!state.canAdd && state.reason ? reasonId : undefined}
        onClick={() => void handleAdd()}
        data-testid="add-to-cart"
      >
        Add to cart
      </button>
      {!state.canAdd && state.reason && (
        <p id={reasonId} className={styles.hint}>
          {state.reason}
        </p>
      )}
      {notice && (
        <p role="status" className={styles.notice} data-testid="cart-notice">
          {notice}
        </p>
      )}
    </div>
  );
}
