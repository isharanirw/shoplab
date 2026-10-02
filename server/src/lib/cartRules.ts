import { ApiError } from './errors';

export const MIN_LINE_QUANTITY = 1;
export const MAX_LINE_QUANTITY = 10;

/** The most a cart line may hold: 10, or the stock when that is lower (never below 0). */
export function lineLimit(stock: number): number {
  return Math.max(0, Math.min(MAX_LINE_QUANTITY, stock));
}

/** Reads a quantity from a request body. It must be a whole number from 1 to 10. */
export function parseQuantity(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < MIN_LINE_QUANTITY || value > MAX_LINE_QUANTITY) {
    throw new ApiError('VALIDATION_ERROR', 'Quantity must be a whole number from 1 to 10.', {
      fieldErrors: { quantity: 'Must be a whole number from 1 to 10.' },
    });
  }
  return value;
}

/** Returns a message when `desired` units cannot sit in one line given the stock, otherwise null. */
export function quantityProblem(desired: number, stock: number): string | null {
  if (stock <= 0) return 'This item is out of stock.';
  if (desired > stock) return `Only ${stock} in stock.`;
  if (desired > MAX_LINE_QUANTITY) return `A cart line can hold at most ${MAX_LINE_QUANTITY}.`;
  return null;
}

export interface MergeLine {
  productId: number;
  variantId: number | null;
  quantity: number;
}

export type AdjustmentReason = 'unavailable' | 'out_of_stock' | 'capped';

export interface MergeAdjustment {
  productId: number;
  variantId: number | null;
  requested: number;
  resulting: number;
  reason: AdjustmentReason;
}

export interface MergeResult {
  lines: MergeLine[];
  adjustments: MergeAdjustment[];
}

const keyOf = (line: { productId: number; variantId: number | null }) => `${line.productId}:${line.variantId ?? 0}`;

/**
 * Merges guest lines into the lines already in a server cart. Same product and variant add their
 * quantities; the result is capped at min(10, stock). A line whose product no longer exists
 * (`stockOf` returns null) or has no stock is dropped. Existing server lines keep their order and
 * new lines follow in guest order. Every cap or drop that touches a guest line is reported in
 * `adjustments`.
 */
export function mergeCartLines(
  existing: MergeLine[],
  incoming: MergeLine[],
  stockOf: (productId: number, variantId: number | null) => number | null,
): MergeResult {
  const order: string[] = [];
  const totals = new Map<string, MergeLine>();
  const incomingKeys = new Set<string>();

  for (const line of existing) {
    const k = keyOf(line);
    if (!totals.has(k)) order.push(k);
    totals.set(k, { ...line, quantity: (totals.get(k)?.quantity ?? 0) + line.quantity });
  }
  for (const line of incoming) {
    const k = keyOf(line);
    if (!totals.has(k)) order.push(k);
    totals.set(k, { ...line, quantity: (totals.get(k)?.quantity ?? 0) + line.quantity });
    incomingKeys.add(k);
  }

  const lines: MergeLine[] = [];
  const adjustments: MergeAdjustment[] = [];
  for (const k of order) {
    const line = totals.get(k)!;
    const stock = stockOf(line.productId, line.variantId);
    const limit = stock === null ? 0 : lineLimit(stock);
    const resulting = Math.min(line.quantity, limit);
    if (resulting < line.quantity && incomingKeys.has(k)) {
      adjustments.push({
        productId: line.productId,
        variantId: line.variantId,
        requested: line.quantity,
        resulting,
        reason: stock === null ? 'unavailable' : stock <= 0 ? 'out_of_stock' : 'capped',
      });
    }
    if (resulting > 0) lines.push({ ...line, quantity: resulting });
  }
  return { lines, adjustments };
}
