import { describe, expect, it } from 'vitest';
import type { Variant } from '../api/types';
import { clampQuantity, findVariant, maxQuantity, optionAvailable, purchaseState, stockLabel, stockLevel, variantAxes } from './variants';

const shirt: Variant[] = [
  { id: 1, size: 'S', colour: 'Grey', stock: 6 },
  { id: 2, size: 'S', colour: 'Navy', stock: 9 },
  { id: 3, size: 'M', colour: 'Grey', stock: 0 },
  { id: 4, size: 'M', colour: 'Navy', stock: 3 },
];
const coloursOnly: Variant[] = [
  { id: 5, size: null, colour: 'Black', stock: 12 },
  { id: 6, size: null, colour: 'Red', stock: 0 },
];
const none = { size: null, colour: null };

describe('stock labels', () => {
  it('uses out, low (1 to 3) and in', () => {
    expect(stockLevel(0)).toBe('out');
    expect(stockLevel(1)).toBe('low');
    expect(stockLevel(3)).toBe('low');
    expect(stockLevel(4)).toBe('in');
    expect(stockLabel(0)).toBe('Out of stock');
    expect(stockLabel(2)).toBe('Only 2 left');
    expect(stockLabel(40)).toBe('In stock');
  });
});

describe('variants', () => {
  it('lists the axes in order', () => {
    expect(variantAxes(shirt)).toEqual({ sizes: ['S', 'M'], colours: ['Grey', 'Navy'] });
    expect(variantAxes(coloursOnly)).toEqual({ sizes: [], colours: ['Black', 'Red'] });
    expect(variantAxes([])).toEqual({ sizes: [], colours: [] });
  });

  it('finds a variant only once every axis is chosen', () => {
    const axes = variantAxes(shirt);
    expect(findVariant(shirt, axes, none)).toBeNull();
    expect(findVariant(shirt, axes, { size: 'S', colour: null })).toBeNull();
    expect(findVariant(shirt, axes, { size: 'S', colour: 'Navy' })?.id).toBe(2);
    expect(findVariant(coloursOnly, variantAxes(coloursOnly), { size: null, colour: 'Black' })?.id).toBe(5);
  });

  it('marks an option unavailable when no in-stock variant matches the other choice', () => {
    expect(optionAvailable(shirt, 'colour', 'Grey', none)).toBe(true);
    expect(optionAvailable(shirt, 'colour', 'Grey', { size: 'M', colour: null })).toBe(false);
    expect(optionAvailable(shirt, 'colour', 'Navy', { size: 'M', colour: null })).toBe(true);
    expect(optionAvailable(shirt, 'size', 'M', { size: null, colour: 'Grey' })).toBe(false);
    expect(optionAvailable(coloursOnly, 'colour', 'Red', none)).toBe(false);
  });
});

describe('quantity', () => {
  it('caps at 10 and at the stock', () => {
    expect(maxQuantity(40)).toBe(10);
    expect(maxQuantity(10)).toBe(10);
    expect(maxQuantity(3)).toBe(3);
    expect(maxQuantity(0)).toBe(0);
  });
  it('clamps typed values into 1..max', () => {
    expect(clampQuantity(0, 5)).toBe(1);
    expect(clampQuantity(-3, 5)).toBe(1);
    expect(clampQuantity(7, 5)).toBe(5);
    expect(clampQuantity(2.9, 5)).toBe(2);
    expect(clampQuantity(Number.NaN, 5)).toBe(1);
    expect(clampQuantity(4, 0)).toBe(0);
  });
});

describe('purchaseState (when Add to cart is enabled)', () => {
  it('is enabled for a plain product with stock', () => {
    expect(purchaseState(5, [], none)).toMatchObject({ canAdd: true, stock: 5, needsOptions: false });
  });
  it('is disabled when the product is out of stock', () => {
    expect(purchaseState(0, [], none)).toMatchObject({ canAdd: false, stock: 0 });
    expect(purchaseState(0, [{ id: 1, size: 'S', colour: 'Blue', stock: 0 }], none).canAdd).toBe(false);
  });
  it('is disabled until size and colour are both chosen', () => {
    expect(purchaseState(18, shirt, none)).toMatchObject({ canAdd: false, needsOptions: true });
    expect(purchaseState(18, shirt, none).reason).toBe('Choose a size and a colour to add this to your cart.');
    expect(purchaseState(18, shirt, { size: 'S', colour: null }).reason).toBe('Choose a colour to add this to your cart.');
    expect(purchaseState(18, shirt, { size: null, colour: 'Navy' }).reason).toBe('Choose a size to add this to your cart.');
    expect(purchaseState(18, shirt, { size: 'S', colour: 'Navy' })).toMatchObject({ canAdd: true, stock: 9 });
  });
  it('needs only a colour when the product has no sizes', () => {
    expect(purchaseState(12, coloursOnly, none).canAdd).toBe(false);
    expect(purchaseState(12, coloursOnly, { size: null, colour: 'Black' })).toMatchObject({ canAdd: true, stock: 12 });
  });
  it('is disabled for a selected variant with no stock', () => {
    expect(purchaseState(18, shirt, { size: 'M', colour: 'Grey' })).toMatchObject({ canAdd: false, stock: 0 });
  });
});
