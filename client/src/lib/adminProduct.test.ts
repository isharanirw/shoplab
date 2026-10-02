import { describe, expect, it } from 'vitest';
import type { AdminProduct } from '../api/types';
import {
  buildProductFormData,
  dollarsText,
  EMPTY_PRODUCT_FORM,
  firstErrorField,
  formErrorsFromServer,
  formFromProduct,
  parseDollars,
  validatePrice,
  validateProductForm,
  validateSalePrice,
  validateStock,
  withCategory,
} from './adminProduct';
import type { ProductFormValues } from './adminProduct';

const valid: ProductFormValues = {
  name: 'Desk Lamp',
  category: 'Home',
  subcategory: 'Lighting',
  description: '',
  price: '25.00',
  salePrice: '',
  stock: '5',
  active: true,
};

describe('parseDollars and dollarsText', () => {
  it('reads dollars with up to 2 decimals as cents', () => {
    expect(parseDollars('19.99')).toBe(1999);
    expect(parseDollars('20')).toBe(2000);
    expect(parseDollars('0.5')).toBe(50);
    expect(parseDollars(' 7.05 ')).toBe(705);
  });

  it('rejects anything else', () => {
    for (const bad of ['', 'abc', '1.234', '-5', '1,50', '$5', '1e3', '12345678']) expect(parseDollars(bad), bad).toBeNull();
  });

  it('writes cents back as dollars', () => {
    expect(dollarsText(1999)).toBe('19.99');
    expect(dollarsText(2000)).toBe('20.00');
    expect(dollarsText(5)).toBe('0.05');
  });
});

describe('price and stock rules', () => {
  it('requires a price from $0.01 to $10,000.00', () => {
    expect(validatePrice('')).toBe('Price is required.');
    expect(validatePrice('0')).toMatch(/between \$0\.01 and \$10,000\.00/);
    expect(validatePrice('10000.01')).toMatch(/between/);
    expect(validatePrice('0.01')).toBeNull();
    expect(validatePrice('10000')).toBeNull();
    expect(validatePrice('1.999')).toMatch(/at most 2 decimals/);
  });

  it('allows an empty sale price but requires it to be below the price', () => {
    expect(validateSalePrice('', '25.00')).toBeNull();
    expect(validateSalePrice('25.00', '25.00')).toBe('Sale price must be below the regular price.');
    expect(validateSalePrice('30', '25.00')).toBe('Sale price must be below the regular price.');
    expect(validateSalePrice('24.99', '25.00')).toBeNull();
    expect(validateSalePrice('0', '25.00')).toMatch(/between/);
    expect(validateSalePrice('x', '25.00')).toMatch(/dollars/);
    // When the price itself is not valid yet, only the sale price format is checked.
    expect(validateSalePrice('10', '')).toBeNull();
  });

  it('requires stock to be a whole number from 0 to 10,000', () => {
    expect(validateStock('')).toBe('Stock is required.');
    expect(validateStock('0')).toBeNull();
    expect(validateStock('10000')).toBeNull();
    for (const bad of ['-1', '1.5', '10001', 'abc', '1e2']) expect(validateStock(bad), bad).toMatch(/whole number/);
  });
});

describe('validateProductForm', () => {
  it('accepts a valid form', () => {
    expect(validateProductForm(valid, null)).toEqual({});
  });

  it('reports every problem with its own message', () => {
    const errors = validateProductForm({ ...EMPTY_PRODUCT_FORM, price: 'x', salePrice: '1' }, null);
    expect(Object.keys(errors).sort()).toEqual(['category', 'name', 'price', 'stock', 'subcategory']);
  });

  it('checks the subcategory against the category and the image like the review form does', () => {
    expect(validateProductForm({ ...valid, subcategory: 'Fiction' }, null).subcategory).toMatch(/Home/);
    const big = { name: 'a.png', size: 3 * 1024 * 1024, type: 'image/png' };
    expect(validateProductForm(valid, big).image).toMatch(/2 MB/);
    expect(validateProductForm(valid, { name: 'a.gif', size: 10, type: 'image/gif' }).image).toMatch(/PNG or JPG/);
  });

  it('skips the stock box for a product with options', () => {
    expect(validateProductForm({ ...valid, stock: '' }, null, true).stock).toBeUndefined();
  });

  it('finds the first field with an error in form order', () => {
    expect(firstErrorField({ price: 'x', name: 'y' })).toBe('name');
    expect(firstErrorField({})).toBeNull();
  });
});

describe('form helpers', () => {
  it('picking a category sets its first subcategory alphabetically', () => {
    expect(withCategory(valid, 'Books')).toMatchObject({ category: 'Books', subcategory: 'Children' });
    expect(withCategory(valid, '')).toMatchObject({ category: '', subcategory: '' });
  });

  it('turns a product into form values', () => {
    const product: AdminProduct = {
      id: 5,
      name: 'Mug',
      category: 'Home',
      subcategory: 'Kitchen',
      description: 'A mug',
      priceCents: 1250,
      salePriceCents: null,
      stock: 3,
      active: false,
      featured: false,
      hasVariants: false,
      imageCount: 1,
      imagePath: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    expect(formFromProduct(product)).toEqual({
      name: 'Mug',
      category: 'Home',
      subcategory: 'Kitchen',
      description: 'A mug',
      price: '12.50',
      salePrice: '',
      stock: '3',
      active: false,
    });
  });

  it('builds the multipart body the API expects', () => {
    const form = buildProductFormData({ ...valid, name: '  Desk Lamp ', price: '25.00', salePrice: '19.5' }, { image: null, removeImage: true, hasVariants: false });
    expect(Object.fromEntries(form.entries())).toEqual({
      name: 'Desk Lamp',
      category: 'Home',
      subcategory: 'Lighting',
      description: '',
      priceCents: '2500',
      salePriceCents: '1950',
      stock: '5',
      active: 'true',
      removeImage: 'true',
    });
  });

  it('sends an empty sale price as "no sale", omits stock for products with options and prefers a new image over removeImage', () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'a.png', { type: 'image/png' });
    const form = buildProductFormData(valid, { image: file, removeImage: true, hasVariants: true });
    expect(form.get('salePriceCents')).toBe('');
    expect(form.has('stock')).toBe(false);
    expect(form.has('removeImage')).toBe(false);
    expect((form.get('image') as File).name).toBe('a.png');
  });

  it('maps the API field names onto form fields', () => {
    expect(formErrorsFromServer({ priceCents: 'p', salePriceCents: 's', stock: 'k', image: 'i', body: 'ignored' })).toEqual({
      price: 'p',
      salePrice: 's',
      stock: 'k',
      image: 'i',
    });
  });
});
