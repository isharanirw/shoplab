import { describe, expect, it } from 'vitest';
import { ApiError } from './errors';
import { lineLimit, mergeCartLines, parseQuantity, quantityProblem } from './cartRules';

describe('quantity rules', () => {
  it('caps a line at 10 or the stock, whichever is lower', () => {
    expect(lineLimit(25)).toBe(10);
    expect(lineLimit(10)).toBe(10);
    expect(lineLimit(4)).toBe(4);
    expect(lineLimit(0)).toBe(0);
    expect(lineLimit(-3)).toBe(0);
  });

  it('accepts whole numbers from 1 to 10 only', () => {
    expect(parseQuantity(1)).toBe(1);
    expect(parseQuantity(10)).toBe(10);
    for (const bad of [0, 11, -1, 1.5, '3', null, undefined, NaN]) {
      expect(() => parseQuantity(bad)).toThrow(ApiError);
    }
  });

  it('explains why a quantity does not fit', () => {
    expect(quantityProblem(2, 0)).toBe('This item is out of stock.');
    expect(quantityProblem(5, 3)).toBe('Only 3 in stock.');
    expect(quantityProblem(11, 50)).toBe('A cart line can hold at most 10.');
    expect(quantityProblem(3, 3)).toBeNull();
  });
});

describe('mergeCartLines (guest cart into server cart)', () => {
  const stock: Record<string, number> = { '1:0': 50, '2:21': 4, '2:22': 0, '3:0': 6 };
  const stockOf = (productId: number, variantId: number | null) => stock[`${productId}:${variantId ?? 0}`] ?? null;

  it('adds quantities for the same product and variant', () => {
    const result = mergeCartLines(
      [{ productId: 1, variantId: null, quantity: 2 }],
      [{ productId: 1, variantId: null, quantity: 3 }],
      stockOf,
    );
    expect(result.lines).toEqual([{ productId: 1, variantId: null, quantity: 5 }]);
    expect(result.adjustments).toEqual([]);
  });

  it('caps the merged quantity at 10 and reports it', () => {
    const result = mergeCartLines(
      [{ productId: 1, variantId: null, quantity: 8 }],
      [{ productId: 1, variantId: null, quantity: 5 }],
      stockOf,
    );
    expect(result.lines[0]?.quantity).toBe(10);
    expect(result.adjustments).toEqual([{ productId: 1, variantId: null, requested: 13, resulting: 10, reason: 'capped' }]);
  });

  it('caps at the stock of the variant', () => {
    const result = mergeCartLines(
      [{ productId: 2, variantId: 21, quantity: 3 }],
      [{ productId: 2, variantId: 21, quantity: 3 }],
      stockOf,
    );
    expect(result.lines).toEqual([{ productId: 2, variantId: 21, quantity: 4 }]);
    expect(result.adjustments[0]).toMatchObject({ reason: 'capped', requested: 6, resulting: 4 });
  });

  it('keeps different variants of one product as separate lines', () => {
    const result = mergeCartLines(
      [{ productId: 2, variantId: 21, quantity: 1 }],
      [{ productId: 2, variantId: 22, quantity: 1 }],
      (p, v) => (v === null ? null : 5 + p),
    );
    expect(result.lines).toHaveLength(2);
  });

  it('drops sold-out and missing products and says why', () => {
    const result = mergeCartLines(
      [],
      [
        { productId: 2, variantId: 22, quantity: 2 },
        { productId: 99, variantId: null, quantity: 1 },
        { productId: 3, variantId: null, quantity: 1 },
      ],
      stockOf,
    );
    expect(result.lines).toEqual([{ productId: 3, variantId: null, quantity: 1 }]);
    expect(result.adjustments.map((a) => a.reason)).toEqual(['out_of_stock', 'unavailable']);
  });

  it('keeps server lines first and appends new guest lines; duplicate guest lines add up', () => {
    const result = mergeCartLines(
      [{ productId: 3, variantId: null, quantity: 1 }],
      [
        { productId: 1, variantId: null, quantity: 1 },
        { productId: 1, variantId: null, quantity: 2 },
      ],
      stockOf,
    );
    expect(result.lines).toEqual([
      { productId: 3, variantId: null, quantity: 1 },
      { productId: 1, variantId: null, quantity: 3 },
    ]);
  });
});
