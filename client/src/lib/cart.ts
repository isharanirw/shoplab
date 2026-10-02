import { MAX_QUANTITY } from './variants';

/** One cart line as the product pages send it. */
export interface CartLine {
  productId: number;
  variantId: number | null;
  quantity: number;
}

export const GUEST_CART_KEY = 'shoplab.guestCart';

/** The part of `Storage` this module uses, so tests can pass a fake. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const lineKey = (line: { productId: number; variantId: number | null }): string => `${line.productId}:${line.variantId ?? 0}`;

/** The most one line can hold: 10, or the stock when that is lower. */
export function lineLimit(stock: number): number {
  return Math.max(0, Math.min(MAX_QUANTITY, stock));
}

/** Why `desired` units cannot sit in one line, or null when they can. Same wording as the API. */
export function quantityProblem(desired: number, stock: number): string | null {
  if (stock <= 0) return 'This item is out of stock.';
  if (desired > stock) return `Only ${stock} in stock.`;
  if (desired > MAX_QUANTITY) return `A cart line can hold at most ${MAX_QUANTITY}.`;
  return null;
}

/**
 * Reads the stored guest cart. Anything unreadable (not JSON, wrong shape, bad numbers) is ignored
 * line by line, and duplicate product and variant pairs are added together up to the limit of 10.
 */
export function parseGuestCart(raw: string | null): CartLine[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const lines: CartLine[] = [];
  for (const entry of data) {
    if (!entry || typeof entry !== 'object') continue;
    const { productId, variantId, quantity } = entry as Record<string, unknown>;
    if (typeof productId !== 'number' || !Number.isInteger(productId) || productId < 1) continue;
    if (variantId !== null && variantId !== undefined && (typeof variantId !== 'number' || !Number.isInteger(variantId) || variantId < 1)) continue;
    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1) continue;
    const line: CartLine = { productId, variantId: variantId ?? null, quantity: Math.min(quantity, MAX_QUANTITY) };
    const existing = lines.find((l) => lineKey(l) === lineKey(line));
    if (existing) existing.quantity = Math.min(existing.quantity + line.quantity, MAX_QUANTITY);
    else lines.push(line);
  }
  return lines;
}

export function guestItemCount(lines: CartLine[]): number {
  return lines.reduce((n, l) => n + l.quantity, 0);
}

export interface GuestChange {
  lines: CartLine[];
  error: string | null;
}

/** Adds to the guest cart, merging into a line for the same product and variant. */
export function addGuestLine(lines: CartLine[], line: CartLine, stock: number): GuestChange {
  const existing = lines.find((l) => lineKey(l) === lineKey(line));
  const total = (existing?.quantity ?? 0) + line.quantity;
  const problem = quantityProblem(total, stock);
  if (problem) {
    const note = existing ? ` You already have ${existing.quantity} in your cart.` : '';
    return { lines, error: `${problem}${note}` };
  }
  if (existing) {
    return { lines: lines.map((l) => (lineKey(l) === lineKey(line) ? { ...l, quantity: total } : l)), error: null };
  }
  return { lines: [...lines, { ...line }], error: null };
}

/** Sets one guest line to an exact quantity (1 to 10, within the stock). */
export function setGuestQuantity(lines: CartLine[], key: string, quantity: number, stock: number): GuestChange {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
    return { lines, error: `Quantity must be a whole number from 1 to ${MAX_QUANTITY}.` };
  }
  const problem = quantityProblem(quantity, stock);
  if (problem) return { lines, error: problem };
  return { lines: lines.map((l) => (lineKey(l) === key ? { ...l, quantity } : l)), error: null };
}

export function removeGuestLine(lines: CartLine[], key: string): CartLine[] {
  return lines.filter((l) => lineKey(l) !== key);
}

function defaultStorage(): StorageLike | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function loadGuestCart(storage: StorageLike | null = defaultStorage()): CartLine[] {
  try {
    return parseGuestCart(storage?.getItem(GUEST_CART_KEY) ?? null);
  } catch {
    return [];
  }
}

export function saveGuestCart(lines: CartLine[], storage: StorageLike | null = defaultStorage()): void {
  try {
    if (lines.length === 0) storage?.removeItem(GUEST_CART_KEY);
    else storage?.setItem(GUEST_CART_KEY, JSON.stringify(lines));
  } catch {
    // Storage can be blocked or full; the cart then simply does not persist.
  }
}

/** One sentence per line the server had to change while merging, for the notice shown after login. */
export function describeMerge(
  report: { name: string; requested: number; resulting: number; reason: 'unavailable' | 'out_of_stock' | 'capped' }[],
): string[] {
  return report.map((r) => {
    if (r.reason === 'capped') return `${r.name}: quantity reduced to ${r.resulting} (the most available).`;
    if (r.reason === 'out_of_stock') return `${r.name} is out of stock and was not added.`;
    return `${r.name} is no longer available and was not added.`;
  });
}
