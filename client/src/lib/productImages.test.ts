import { describe, expect, it } from 'vitest';
import { categoryFallbackUrl, imageAlt, imageAt, resolveImages } from './productImages';

describe('categoryFallbackUrl', () => {
  it('uses the category illustration, ignoring case and spaces', () => {
    expect(categoryFallbackUrl('Books')).toBe('/images/categories/books.svg');
    expect(categoryFallbackUrl('  TOYS ')).toBe('/images/categories/toys.svg');
  });

  it('uses the general illustration for unknown or missing categories', () => {
    expect(categoryFallbackUrl('Garden')).toBe('/images/categories/general.svg');
    expect(categoryFallbackUrl(null)).toBe('/images/categories/general.svg');
    expect(categoryFallbackUrl(undefined)).toBe('/images/categories/general.svg');
  });
});

describe('resolveImages', () => {
  const illustrations = ['/images/products/4/1.svg', '/images/products/4/2.svg', '/images/products/4/3.svg'];

  it('lets an uploaded image replace everything else', () => {
    expect(resolveImages({ imagePath: '/uploads/p.png', images: illustrations, category: 'Home' })).toEqual(['/uploads/p.png']);
  });

  it('uses the list from the API', () => {
    expect(resolveImages({ images: illustrations, imagePath: null })).toEqual(illustrations);
  });

  it('falls back to the category illustration when there is nothing else', () => {
    expect(resolveImages({ category: 'Sports' })).toEqual(['/images/categories/sports.svg']);
    expect(resolveImages({ images: [], category: 'Sports' })).toEqual(['/images/categories/sports.svg']);
    expect(resolveImages({})).toEqual(['/images/categories/general.svg']);
  });

  it('returns a copy, not the original array', () => {
    const result = resolveImages({ images: illustrations });
    expect(result).not.toBe(illustrations);
  });
});

describe('imageAt', () => {
  it('picks by index and falls back to the first picture', () => {
    expect(imageAt(['a', 'b', 'c'], 1)).toBe('b');
    expect(imageAt(['a', 'b', 'c'], 7)).toBe('a');
    expect(imageAt([], 0)).toBe('/images/categories/general.svg');
  });
});

describe('imageAlt', () => {
  it('numbers the views of a gallery', () => {
    expect(imageAlt('Smart Lamp', 0, 3)).toBe('Smart Lamp, view 1 of 3');
    expect(imageAlt('Smart Lamp', 2, 3)).toBe('Smart Lamp, view 3 of 3');
  });

  it('uses just the name for a single picture', () => {
    expect(imageAlt('Smart Lamp', 0, 1)).toBe('Smart Lamp');
  });
});
