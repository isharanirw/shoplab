import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiRequestError } from '../api/client';
import type { CartItem, ProductDetail } from '../api/types';
import { lineLimit } from '../lib/cart';
import type { CartLine } from '../lib/cart';

export type GuestCartStatus = 'loading' | 'ready' | 'error';

export interface GuestCartView {
  status: GuestCartStatus;
  items: CartItem[];
  subtotalCents: number;
  itemCount: number;
  /** Lines whose product no longer exists; the page removes them from the stored cart. */
  gone: CartLine[];
  errorMessage: string | null;
  retry: () => void;
}

/** Looks up product details for the guest cart's lines so they can be shown like server cart lines. */
export function useGuestCart(lines: CartLine[]): GuestCartView {
  const [products, setProducts] = useState<Record<number, ProductDetail | null>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const missingIds = useMemo(() => {
    const ids = new Set<number>();
    for (const line of lines) if (!(line.productId in products)) ids.add(line.productId);
    return [...ids].sort((a, b) => a - b);
  }, [lines, products]);
  const missingKey = missingIds.join(',');

  useEffect(() => {
    if (missingKey === '') return;
    const controller = new AbortController();
    const ids = missingKey.split(',').map(Number);
    setErrorMessage(null);
    Promise.all(
      ids.map(async (id) => {
        try {
          return [id, await api<ProductDetail>(`/api/products/${id}`, { signal: controller.signal })] as const;
        } catch (err) {
          if (err instanceof ApiRequestError && (err.status === 404 || err.status === 400)) return [id, null] as const;
          throw err;
        }
      }),
    )
      .then((entries) => {
        if (controller.signal.aborted) return;
        setProducts((current) => ({ ...current, ...Object.fromEntries(entries) }));
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setErrorMessage(err instanceof ApiRequestError ? err.message : 'Could not load your cart. Please try again.');
      });
    return () => controller.abort();
  }, [missingKey, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return useMemo(() => {
    const items: CartItem[] = [];
    const gone: CartLine[] = [];
    lines.forEach((line, index) => {
      const product = products[line.productId];
      if (product === undefined) return;
      if (product === null) {
        gone.push(line);
        return;
      }
      const variant = line.variantId === null ? null : (product.variants.find((v) => v.id === line.variantId) ?? null);
      if (line.variantId !== null && !variant) {
        gone.push(line);
        return;
      }
      const stock = variant ? variant.stock : product.stock;
      const unit = product.salePriceCents ?? product.priceCents;
      items.push({
        id: index + 1,
        productId: product.id,
        variantId: line.variantId,
        name: product.name,
        category: product.category,
        imageCount: product.imageCount,
        imagePath: product.imagePath,
        variantLabel: variant ? [variant.size, variant.colour].filter(Boolean).join(' / ') || null : null,
        unitPriceCents: unit,
        regularPriceCents: product.priceCents,
        onSale: product.salePriceCents !== null,
        quantity: line.quantity,
        lineTotalCents: unit * line.quantity,
        stock,
        maxQuantity: lineLimit(stock),
        inStock: stock > 0,
      });
    });
    const loading = missingIds.length > 0 && errorMessage === null;
    const status: GuestCartStatus = errorMessage !== null && missingIds.length > 0 ? 'error' : loading ? 'loading' : 'ready';
    return {
      status,
      items,
      subtotalCents: items.reduce((sum, i) => sum + i.lineTotalCents, 0),
      itemCount: items.reduce((n, i) => n + i.quantity, 0),
      gone,
      errorMessage,
      retry,
    };
  }, [lines, products, missingIds.length, errorMessage, retry]);
}
