import { describe, expect, it } from 'vitest';
import {
  FALLBACK_SLUGS,
  IMAGES_PER_PRODUCT,
  ILLUSTRATED_PRODUCT_COUNT,
  categoryFallbackUrl,
  categorySlug,
  hasIllustration,
  illustrationUrls,
  productImageUrls,
} from './productImages';

describe('categorySlug and categoryFallbackUrl', () => {
  it('maps the six categories to their own illustration', () => {
    for (const slug of FALLBACK_SLUGS) {
      expect(categoryFallbackUrl(slug)).toBe(`/images/categories/${slug}.svg`);
    }
    expect(categoryFallbackUrl('Electronics')).toBe('/images/categories/electronics.svg');
    expect(categoryFallbackUrl(' toys ')).toBe('/images/categories/toys.svg');
  });

  it('uses the general illustration for anything else', () => {
    expect(categorySlug('Garden')).toBe('general');
    expect(categorySlug('')).toBe('general');
    expect(categorySlug(null)).toBe('general');
    expect(categorySlug(undefined)).toBe('general');
  });
});

describe('illustrations', () => {
  it('covers the 60 seeded products and no others', () => {
    expect(hasIllustration(1)).toBe(true);
    expect(hasIllustration(ILLUSTRATED_PRODUCT_COUNT)).toBe(true);
    expect(hasIllustration(0)).toBe(false);
    expect(hasIllustration(ILLUSTRATED_PRODUCT_COUNT + 1)).toBe(false);
    expect(hasIllustration(1.5)).toBe(false);
    expect(hasIllustration(-3)).toBe(false);
  });

  it('lists three numbered files per product', () => {
    expect(illustrationUrls(23)).toEqual(['/images/products/23/1.svg', '/images/products/23/2.svg', '/images/products/23/3.svg']);
    expect(illustrationUrls(23)).toHaveLength(IMAGES_PER_PRODUCT);
  });
});

describe('productImageUrls', () => {
  it('shows only the uploaded image when there is one', () => {
    expect(productImageUrls({ id: 4, category: 'Electronics', imagePath: '/uploads/products/abc.png' })).toEqual(['/uploads/products/abc.png']);
  });

  it('shows the three illustrations of a seeded product', () => {
    expect(productImageUrls({ id: 4, category: 'Electronics', imagePath: null })).toEqual(illustrationUrls(4));
    expect(productImageUrls({ id: 23, category: 'Home', imagePath: null })).toEqual(illustrationUrls(23));
  });

  it('shows one category illustration for a product with no picture at all', () => {
    expect(productImageUrls({ id: 61, category: 'Home', imagePath: null })).toEqual(['/images/categories/home.svg']);
    expect(productImageUrls({ id: 99, category: 'Unknown', imagePath: null })).toEqual(['/images/categories/general.svg']);
  });

  it('never returns an empty list', () => {
    for (const id of [0, 1, 60, 61, 1000]) {
      expect(productImageUrls({ id, category: '', imagePath: null }).length).toBeGreaterThan(0);
    }
  });
});
