/**
 * Where the pictures of a product come from. The seeded products have three self-hosted illustrations each
 * (static SVG files under /images/products/<id>/<n>.svg, made by `npm run generate:images`). A product with an
 * image uploaded by an admin shows that one picture instead. Anything else (a product an admin created without an
 * image) shows one clean illustration in its category's colours.
 */

export const IMAGES_PER_PRODUCT = 3;
/** The seeded products 1 to 60 have illustrations. IDs are never reused, so new products always have a higher ID. */
export const ILLUSTRATED_PRODUCT_COUNT = 60;
export const PRODUCT_IMAGE_DIR = '/images/products';
export const CATEGORY_IMAGE_DIR = '/images/categories';
export const FALLBACK_SLUGS = ['electronics', 'clothing', 'home', 'sports', 'books', 'toys'] as const;
export const GENERAL_SLUG = 'general';

export interface ImageSubject {
  id: number;
  category: string;
  imagePath: string | null;
}

/** Lower-case slug of a known category; anything else (or nothing) is "general". */
export function categorySlug(category: string | null | undefined): string {
  const slug = (category ?? '').trim().toLowerCase();
  return (FALLBACK_SLUGS as readonly string[]).includes(slug) ? slug : GENERAL_SLUG;
}

export function categoryFallbackUrl(category: string | null | undefined): string {
  return `${CATEGORY_IMAGE_DIR}/${categorySlug(category)}.svg`;
}

export function hasIllustration(productId: number): boolean {
  return Number.isInteger(productId) && productId >= 1 && productId <= ILLUSTRATED_PRODUCT_COUNT;
}

export function illustrationUrls(productId: number): string[] {
  return Array.from({ length: IMAGES_PER_PRODUCT }, (_, i) => `${PRODUCT_IMAGE_DIR}/${productId}/${i + 1}.svg`);
}

/** Every picture URL for a product, in gallery order. Never empty. */
export function productImageUrls(subject: ImageSubject): string[] {
  if (subject.imagePath) return [subject.imagePath];
  if (hasIllustration(subject.id)) return illustrationUrls(subject.id);
  return [categoryFallbackUrl(subject.category)];
}
