import type { Variant } from '../api/types';

export const MAX_QUANTITY = 10;
export const LOW_STOCK_THRESHOLD = 3;

export type StockLevel = 'out' | 'low' | 'in';

export function stockLevel(stock: number): StockLevel {
  if (stock <= 0) return 'out';
  return stock <= LOW_STOCK_THRESHOLD ? 'low' : 'in';
}

export function stockLabel(stock: number): string {
  const level = stockLevel(stock);
  if (level === 'out') return 'Out of stock';
  if (level === 'low') return `Only ${stock} left`;
  return 'In stock';
}

export interface Selection {
  size: string | null;
  colour: string | null;
}

export interface Axes {
  sizes: string[];
  colours: string[];
}

function unique(values: (string | null)[]): string[] {
  const out: string[] = [];
  for (const v of values) if (v !== null && !out.includes(v)) out.push(v);
  return out;
}

/** The sizes and colours a product offers, in the order the variants are listed. */
export function variantAxes(variants: Variant[]): Axes {
  return { sizes: unique(variants.map((v) => v.size)), colours: unique(variants.map((v) => v.colour)) };
}

/** The variant matching a selection, or null until every axis the product has is chosen. */
export function findVariant(variants: Variant[], axes: Axes, sel: Selection): Variant | null {
  if (axes.sizes.length > 0 && sel.size === null) return null;
  if (axes.colours.length > 0 && sel.colour === null) return null;
  return variants.find((v) => v.size === sel.size && v.colour === sel.colour) ?? null;
}

/**
 * Whether an option can still be bought given what is already chosen on the other axis:
 * at least one matching variant must have stock.
 */
export function optionAvailable(variants: Variant[], axis: 'size' | 'colour', value: string, sel: Selection): boolean {
  return variants.some((v) => {
    if (v[axis] !== value || v.stock <= 0) return false;
    if (axis === 'size' && sel.colour !== null && v.colour !== sel.colour) return false;
    if (axis === 'colour' && sel.size !== null && v.size !== sel.size) return false;
    return true;
  });
}

/** The most that can be ordered at once: the stock on hand, capped at 10. */
export function maxQuantity(stock: number): number {
  return Math.max(0, Math.min(MAX_QUANTITY, stock));
}

export function clampQuantity(quantity: number, max: number): number {
  if (!Number.isFinite(quantity)) return Math.min(1, max);
  return Math.max(Math.min(1, max), Math.min(Math.trunc(quantity), max));
}

export interface PurchaseState {
  /** Stock that applies to the current selection (the chosen variant, or the product total). */
  stock: number;
  variant: Variant | null;
  needsOptions: boolean;
  canAdd: boolean;
  /** Short explanation shown when the button is disabled. */
  reason: string | null;
}

export function purchaseState(productStock: number, variants: Variant[], sel: Selection): PurchaseState {
  const axes = variantAxes(variants);
  const hasOptions = variants.length > 0;
  if (productStock <= 0) {
    return { stock: 0, variant: null, needsOptions: false, canAdd: false, reason: 'This product is out of stock.' };
  }
  if (!hasOptions) return { stock: productStock, variant: null, needsOptions: false, canAdd: true, reason: null };

  const variant = findVariant(variants, axes, sel);
  if (!variant) {
    const missing = [axes.sizes.length > 0 && sel.size === null ? 'a size' : null, axes.colours.length > 0 && sel.colour === null ? 'a colour' : null]
      .filter(Boolean)
      .join(' and ');
    return { stock: productStock, variant: null, needsOptions: true, canAdd: false, reason: `Choose ${missing || 'an available option'} to add this to your cart.` };
  }
  if (variant.stock <= 0) {
    return { stock: 0, variant, needsOptions: false, canAdd: false, reason: 'This option is out of stock.' };
  }
  return { stock: variant.stock, variant, needsOptions: false, canAdd: true, reason: null };
}
