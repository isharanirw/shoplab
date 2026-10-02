import { describe, expect, it } from 'vitest';
import { ApiError } from './errors';
import { coerceFormFields, parseProductCreate, parseProductPatch, PRICE_MAX_CENTS, STOCK_MAX } from './productRules';
import type { CurrentProduct } from './productRules';

function fieldErrorsOf(fn: () => unknown): Record<string, string> {
  try {
    fn();
  } catch (err) {
    if (err instanceof ApiError && err.code === 'VALIDATION_ERROR') return err.fieldErrors ?? {};
    throw err;
  }
  throw new Error('Expected a validation error');
}

const valid = { name: 'Desk Lamp', category: 'Home', priceCents: 2500, stock: 5 };
const current: CurrentProduct = { category: 'Home', subcategory: 'Lighting', priceCents: 2500, salePriceCents: 2000, hasVariants: false };

describe('parseProductCreate', () => {
  it('accepts the minimum fields and fills the defaults', () => {
    expect(parseProductCreate(valid)).toEqual({
      name: 'Desk Lamp',
      category: 'Home',
      subcategory: 'Appliances',
      description: 'No description provided.',
      priceCents: 2500,
      salePriceCents: null,
      stock: 5,
      active: true,
    });
  });

  it('trims the name, canonicalises the category and keeps a valid subcategory and sale price', () => {
    const p = parseProductCreate({ ...valid, name: '  Desk Lamp  ', category: 'home', subcategory: 'lighting', salePriceCents: 1999, active: false });
    expect(p).toMatchObject({ name: 'Desk Lamp', category: 'Home', subcategory: 'Lighting', salePriceCents: 1999, active: false });
  });

  it('reports every problem at once', () => {
    const errors = fieldErrorsOf(() => parseProductCreate({ name: 'x', category: 'Cars', priceCents: 0, stock: -1 }));
    expect(Object.keys(errors).sort()).toEqual(['category', 'name', 'priceCents', 'stock']);
  });

  it('requires name, category, price and stock', () => {
    expect(Object.keys(fieldErrorsOf(() => parseProductCreate({}))).sort()).toEqual(['category', 'name', 'priceCents', 'stock']);
  });

  it('checks the price bounds and that the price is a whole number of cents', () => {
    expect(fieldErrorsOf(() => parseProductCreate({ ...valid, priceCents: 0 })).priceCents).toMatch(/between \$0\.01 and \$10,000\.00/);
    expect(fieldErrorsOf(() => parseProductCreate({ ...valid, priceCents: PRICE_MAX_CENTS + 1 })).priceCents).toBeDefined();
    expect(fieldErrorsOf(() => parseProductCreate({ ...valid, priceCents: 12.5 })).priceCents).toMatch(/whole number/);
    expect(fieldErrorsOf(() => parseProductCreate({ ...valid, priceCents: '2500' })).priceCents).toMatch(/whole number/);
    expect(parseProductCreate({ ...valid, priceCents: PRICE_MAX_CENTS }).priceCents).toBe(PRICE_MAX_CENTS);
    expect(parseProductCreate({ ...valid, priceCents: 1 }).priceCents).toBe(1);
  });

  it('requires the sale price to be below the price', () => {
    expect(fieldErrorsOf(() => parseProductCreate({ ...valid, salePriceCents: 2500 })).salePriceCents).toMatch(/below the regular price/);
    expect(fieldErrorsOf(() => parseProductCreate({ ...valid, salePriceCents: 3000 })).salePriceCents).toMatch(/below the regular price/);
    expect(fieldErrorsOf(() => parseProductCreate({ ...valid, salePriceCents: 0 })).salePriceCents).toBeDefined();
    expect(parseProductCreate({ ...valid, salePriceCents: 2499 }).salePriceCents).toBe(2499);
    expect(parseProductCreate({ ...valid, salePriceCents: null }).salePriceCents).toBeNull();
  });

  it('requires stock to be a whole number from 0 up to the maximum', () => {
    expect(parseProductCreate({ ...valid, stock: 0 }).stock).toBe(0);
    expect(parseProductCreate({ ...valid, stock: STOCK_MAX }).stock).toBe(STOCK_MAX);
    for (const stock of [-1, 1.5, STOCK_MAX + 1, '5', true]) {
      expect(fieldErrorsOf(() => parseProductCreate({ ...valid, stock })).stock).toBeDefined();
    }
  });

  it('rejects a subcategory from another category and a non-boolean active', () => {
    expect(fieldErrorsOf(() => parseProductCreate({ ...valid, subcategory: 'Fiction' })).subcategory).toMatch(/Unknown subcategory for Home/);
    expect(fieldErrorsOf(() => parseProductCreate({ ...valid, active: 'yes' })).active).toBeDefined();
  });

  it('limits name and description length', () => {
    expect(fieldErrorsOf(() => parseProductCreate({ ...valid, name: 'a'.repeat(151) })).name).toMatch(/2 to 150/);
    expect(fieldErrorsOf(() => parseProductCreate({ ...valid, description: 'a'.repeat(2001) })).description).toBeDefined();
  });
});

describe('parseProductPatch', () => {
  it('changes only the fields that were sent', () => {
    expect(parseProductPatch({ name: 'New name' }, current)).toEqual({ name: 'New name' });
  });

  it('rejects an empty body unless an image file came with it', () => {
    expect(fieldErrorsOf(() => parseProductPatch({}, current)).body).toBeDefined();
    expect(parseProductPatch({}, current, true)).toEqual({});
  });

  it('keeps the sale price below the resulting price', () => {
    expect(fieldErrorsOf(() => parseProductPatch({ priceCents: 1500 }, current)).salePriceCents).toMatch(/below the regular price/);
    expect(parseProductPatch({ priceCents: 1500, salePriceCents: null }, current)).toEqual({ priceCents: 1500, salePriceCents: null });
    expect(parseProductPatch({ priceCents: 1500, salePriceCents: 1000 }, current)).toEqual({ priceCents: 1500, salePriceCents: 1000 });
    expect(fieldErrorsOf(() => parseProductPatch({ salePriceCents: 2500 }, current)).salePriceCents).toBeDefined();
  });

  it('moves to the default subcategory when only the category changes', () => {
    expect(parseProductPatch({ category: 'Books' }, current)).toEqual({ category: 'Books', subcategory: 'Children' });
    expect(parseProductPatch({ category: 'Books', subcategory: 'Fiction' }, current)).toEqual({ category: 'Books', subcategory: 'Fiction' });
    expect(fieldErrorsOf(() => parseProductPatch({ subcategory: 'Fiction' }, current)).subcategory).toBeDefined();
  });

  it('refuses to set the stock of a product with variants', () => {
    expect(fieldErrorsOf(() => parseProductPatch({ stock: 5 }, { ...current, hasVariants: true })).stock).toMatch(/variants/);
  });

  it('accepts active and removeImage as booleans only', () => {
    expect(parseProductPatch({ active: false, removeImage: true }, current)).toEqual({ active: false, removeImage: true });
    expect(fieldErrorsOf(() => parseProductPatch({ removeImage: 'yes' }, current)).removeImage).toBeDefined();
  });
});

describe('coerceFormFields', () => {
  it('turns form text into the types the rules expect', () => {
    expect(coerceFormFields({ name: 'A', priceCents: '1999', stock: '4', active: 'false', salePriceCents: '' })).toEqual({
      name: 'A',
      priceCents: 1999,
      stock: 4,
      active: false,
      salePriceCents: null,
    });
  });

  it('leaves text that is not a number so the rules report it, and treats blank price or stock as missing', () => {
    expect(coerceFormFields({ priceCents: '12.5', stock: '', active: 'maybe' })).toEqual({ priceCents: '12.5', active: 'maybe' });
  });
});
