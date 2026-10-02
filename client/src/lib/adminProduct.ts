import type { AdminProduct } from '../api/types';
import { validateImageFile } from './reviewForm';
import { CATEGORY_NAMES, defaultSubcategory, TAXONOMY } from './taxonomy';

// Mirrors server/src/lib/productRules.ts so inline messages match what the API returns.
export const NAME_MIN = 2;
export const NAME_MAX = 150;
export const DESCRIPTION_MAX = 2000;
export const PRICE_MIN_CENTS = 1;
export const PRICE_MAX_CENTS = 1_000_000;
export const STOCK_MAX = 10_000;

/** What the form holds: money as dollars text (what a person types), stock as text. */
export interface ProductFormValues {
  name: string;
  category: string;
  subcategory: string;
  description: string;
  price: string;
  salePrice: string;
  stock: string;
  active: boolean;
}

export type ProductField = 'name' | 'category' | 'subcategory' | 'description' | 'price' | 'salePrice' | 'stock' | 'image';
export type ProductErrors = Partial<Record<ProductField, string>>;

export const EMPTY_PRODUCT_FORM: ProductFormValues = {
  name: '',
  category: '',
  subcategory: '',
  description: '',
  price: '',
  salePrice: '',
  stock: '',
  active: true,
};

/** "19.99" or "20" becomes cents; null when the text is not an amount with at most 2 decimals. */
export function parseDollars(text: string): number | null {
  const match = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(text.trim());
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
}

/** 1999 becomes "19.99" (what goes in the input box). */
export function dollarsText(cents: number): string {
  return (cents / 100).toFixed(2);
}

const money = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
const PRICE_RANGE = `between ${money(PRICE_MIN_CENTS)} and ${money(PRICE_MAX_CENTS)}`;

export function validateName(value: string): string | null {
  const name = value.trim();
  if (name === '') return 'Name is required.';
  if (name.length < NAME_MIN || name.length > NAME_MAX) return `Name must be ${NAME_MIN} to ${NAME_MAX} characters.`;
  return null;
}

export function validateCategory(value: string): string | null {
  if (value === '') return 'Category is required.';
  return CATEGORY_NAMES.includes(value) ? null : 'Choose one of the listed categories.';
}

export function validateSubcategory(category: string, value: string): string | null {
  if (value === '') return 'Subcategory is required.';
  return TAXONOMY[category]?.includes(value) ? null : `Choose a subcategory of ${category || 'the category'}.`;
}

export function validateDescription(value: string): string | null {
  return value.trim().length > DESCRIPTION_MAX ? `Description must be at most ${DESCRIPTION_MAX} characters.` : null;
}

export function validatePrice(text: string): string | null {
  if (text.trim() === '') return 'Price is required.';
  const cents = parseDollars(text);
  if (cents === null) return 'Enter an amount in dollars with at most 2 decimals, such as 19.99.';
  if (cents < PRICE_MIN_CENTS || cents > PRICE_MAX_CENTS) return `Price must be ${PRICE_RANGE}.`;
  return null;
}

/** The sale price is optional (empty means no sale) and must be below the regular price when that is valid. */
export function validateSalePrice(text: string, priceText: string): string | null {
  if (text.trim() === '') return null;
  const cents = parseDollars(text);
  if (cents === null) return 'Enter an amount in dollars with at most 2 decimals, such as 14.99.';
  if (cents < PRICE_MIN_CENTS || cents > PRICE_MAX_CENTS) return `Sale price must be ${PRICE_RANGE}.`;
  const price = parseDollars(priceText);
  if (price !== null && cents >= price) return 'Sale price must be below the regular price.';
  return null;
}

export function validateStock(text: string): string | null {
  if (text.trim() === '') return 'Stock is required.';
  if (!/^\d{1,5}$/.test(text.trim()) || Number(text) > STOCK_MAX) return `Stock must be a whole number from 0 to ${STOCK_MAX.toLocaleString('en-US')}.`;
  return null;
}

/**
 * Checks the whole form. A product with options takes its stock from them, so the stock box is not checked for it
 * (it is read-only in the form).
 */
export function validateProductForm(
  values: ProductFormValues,
  file: { name: string; size: number; type: string } | null,
  hasVariants = false,
): ProductErrors {
  const errors: ProductErrors = {};
  const set = (field: ProductField, message: string | null) => {
    if (message) errors[field] = message;
  };
  set('name', validateName(values.name));
  set('category', validateCategory(values.category));
  set('subcategory', validateSubcategory(values.category, values.subcategory));
  set('description', validateDescription(values.description));
  set('price', validatePrice(values.price));
  set('salePrice', validateSalePrice(values.salePrice, values.price));
  if (!hasVariants) set('stock', validateStock(values.stock));
  set('image', validateImageFile(file));
  return errors;
}

/** The form values for an existing product. */
export function formFromProduct(p: AdminProduct): ProductFormValues {
  return {
    name: p.name,
    category: p.category,
    subcategory: p.subcategory,
    description: p.description,
    price: dollarsText(p.priceCents),
    salePrice: p.salePriceCents === null ? '' : dollarsText(p.salePriceCents),
    stock: String(p.stock),
    active: p.active,
  };
}

/** Picks a category: the subcategory follows it (the first one alphabetically) so the form never holds a mismatch. */
export function withCategory(values: ProductFormValues, category: string): ProductFormValues {
  return { ...values, category, subcategory: category === '' ? '' : defaultSubcategory(category) };
}

export interface ProductFormOptions {
  image: File | null;
  /** Edit only: drop the current image. Ignored when a new file is chosen. */
  removeImage: boolean;
  /** Products with options keep their stock in the variants, so the stock field is not sent. */
  hasVariants: boolean;
}

/** The multipart body for POST or PATCH /api/admin/products: every field as text, plus the image file. */
export function buildProductFormData(values: ProductFormValues, options: ProductFormOptions): FormData {
  const form = new FormData();
  form.set('name', values.name.trim());
  form.set('category', values.category);
  form.set('subcategory', values.subcategory);
  form.set('description', values.description);
  form.set('priceCents', String(parseDollars(values.price) ?? ''));
  const sale = values.salePrice.trim() === '' ? null : parseDollars(values.salePrice);
  form.set('salePriceCents', sale === null ? '' : String(sale));
  if (!options.hasVariants) form.set('stock', values.stock.trim());
  form.set('active', values.active ? 'true' : 'false');
  if (options.image) form.set('image', options.image);
  else if (options.removeImage) form.set('removeImage', 'true');
  return form;
}

const SERVER_FIELD: Record<string, ProductField> = {
  name: 'name',
  category: 'category',
  subcategory: 'subcategory',
  description: 'description',
  priceCents: 'price',
  salePriceCents: 'salePrice',
  stock: 'stock',
  image: 'image',
};

/** Turns the API's `fieldErrors` (priceCents, salePriceCents, ...) into the form's field names. */
export function formErrorsFromServer(fieldErrors: Record<string, string>): ProductErrors {
  const errors: ProductErrors = {};
  for (const [key, message] of Object.entries(fieldErrors)) {
    const field = SERVER_FIELD[key];
    if (field) errors[field] = message;
  }
  return errors;
}

/** The first field with an error, in the order the form shows them, so focus can move there. */
export const FIELD_ORDER: ProductField[] = ['name', 'category', 'subcategory', 'description', 'price', 'salePrice', 'stock', 'image'];

export function firstErrorField(errors: ProductErrors): ProductField | null {
  return FIELD_ORDER.find((f) => errors[f]) ?? null;
}
