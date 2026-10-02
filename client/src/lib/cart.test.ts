import { describe, expect, it } from 'vitest';
import {
  addGuestLine,
  describeMerge,
  GUEST_CART_KEY,
  guestItemCount,
  lineKey,
  loadGuestCart,
  parseGuestCart,
  removeGuestLine,
  saveGuestCart,
  setGuestQuantity,
} from './cart';
import type { CartLine, StorageLike } from './cart';

function fakeStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      data[k] = v;
    },
    removeItem: (k) => {
      delete data[k];
    },
  };
}

const line = (productId: number, quantity: number, variantId: number | null = null): CartLine => ({ productId, variantId, quantity });

describe('guest cart storage', () => {
  it('reads valid lines and ignores junk', () => {
    expect(parseGuestCart(null)).toEqual([]);
    expect(parseGuestCart('not json')).toEqual([]);
    expect(parseGuestCart('{"a":1}')).toEqual([]);
    expect(
      parseGuestCart(
        JSON.stringify([
          { productId: 3, variantId: null, quantity: 2 },
          { productId: 'x', quantity: 1 },
          { productId: 4, quantity: 0 },
          { productId: 5, variantId: 'a', quantity: 1 },
          null,
          { productId: 9, variantId: 2, quantity: 3 },
        ]),
      ),
    ).toEqual([line(3, 2), line(9, 3, 2)]);
  });

  it('adds up duplicate lines and caps them at 10', () => {
    const lines = parseGuestCart(JSON.stringify([line(3, 7), line(3, 6), line(4, 99)]));
    expect(lines).toEqual([line(3, 10), line(4, 10)]);
  });

  it('round trips through storage and removes the key when empty', () => {
    const storage = fakeStorage();
    saveGuestCart([line(3, 2)], storage);
    expect(loadGuestCart(storage)).toEqual([line(3, 2)]);
    saveGuestCart([], storage);
    expect(storage.data[GUEST_CART_KEY]).toBeUndefined();
  });

  it('survives missing or throwing storage', () => {
    expect(loadGuestCart(null)).toEqual([]);
    const broken: StorageLike = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadGuestCart(broken)).toEqual([]);
    expect(() => saveGuestCart([line(1, 1)], broken)).not.toThrow();
  });
});

describe('guest cart changes', () => {
  it('merges the same product and variant into one line', () => {
    const first = addGuestLine([], line(3, 2), 60);
    const second = addGuestLine(first.lines, line(3, 3), 60);
    expect(second.error).toBeNull();
    expect(second.lines).toEqual([line(3, 5)]);
    expect(guestItemCount(second.lines)).toBe(5);
  });

  it('keeps variants separate', () => {
    const lines = addGuestLine(addGuestLine([], line(9, 1, 1), 12).lines, line(9, 1, 2), 8).lines;
    expect(lines.map(lineKey)).toEqual(['9:1', '9:2']);
  });

  it('refuses to go over the stock or over 10, leaving the cart unchanged', () => {
    const base = [line(5, 2)];
    const overStock = addGuestLine(base, line(5, 1), 2);
    expect(overStock.error).toBe('Only 2 in stock. You already have 2 in your cart.');
    expect(overStock.lines).toBe(base);
    expect(addGuestLine([line(3, 8)], line(3, 3), 60).error).toContain('at most 10');
    expect(addGuestLine([], line(7, 1), 0).error).toBe('This item is out of stock.');
  });

  it('sets exact quantities within 1 to 10 and the stock, and removes lines', () => {
    const lines = [line(3, 2), line(5, 1)];
    expect(setGuestQuantity(lines, '3:0', 4, 60).lines[0]).toEqual(line(3, 4));
    expect(setGuestQuantity(lines, '3:0', 11, 60).error).toContain('1 to 10');
    expect(setGuestQuantity(lines, '5:0', 3, 2).error).toBe('Only 2 in stock.');
    expect(removeGuestLine(lines, '3:0')).toEqual([line(5, 1)]);
  });
});

describe('merge notice', () => {
  it('describes each change', () => {
    expect(
      describeMerge([
        { name: 'Lamp', requested: 12, resulting: 10, reason: 'capped' },
        { name: 'Camera', requested: 1, resulting: 0, reason: 'out_of_stock' },
        { name: 'Ghost', requested: 1, resulting: 0, reason: 'unavailable' },
      ]),
    ).toEqual([
      'Lamp: quantity reduced to 10 (the most available).',
      'Camera is out of stock and was not added.',
      'Ghost is no longer available and was not added.',
    ]);
  });
});
