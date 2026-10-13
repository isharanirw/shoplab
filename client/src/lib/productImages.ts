/** Which picture URLs a product shows. The server sends `images`; these helpers keep the screens safe when it is missing. */

export const FALLBACK_CATEGORIES = ['electronics', 'clothing', 'home', 'sports', 'books', 'toys'] as const;
const CATEGORY_IMAGE_DIR = '/images/categories';

export interface ImageSource {
  /** Picture URLs in gallery order, as sent by the API. */
  images?: readonly string[] | null;
  /** An image uploaded by an admin (it is the only picture then). */
  imagePath?: string | null;
  category?: string | null;
}

/** The clean illustration in a category's colours; "general" for anything unknown. */
export function categoryFallbackUrl(category?: string | null): string {
  const slug = (category ?? '').trim().toLowerCase();
  const known = (FALLBACK_CATEGORIES as readonly string[]).includes(slug) ? slug : 'general';
  return `${CATEGORY_IMAGE_DIR}/${known}.svg`;
}

/** Every picture URL for a product: an uploaded image wins, then the API list, then the category illustration. Never empty. */
export function resolveImages(source: ImageSource): string[] {
  if (source.imagePath) return [source.imagePath];
  if (source.images && source.images.length > 0) return [...source.images];
  return [categoryFallbackUrl(source.category)];
}

/** The URL for a zero-based index; an index outside the list falls back to the first picture. */
export function imageAt(urls: readonly string[], index: number): string {
  return urls[index] ?? urls[0] ?? categoryFallbackUrl(null);
}

/** Alt text: "Name, view 2 of 3" for a gallery, just the name when there is a single picture. */
export function imageAlt(name: string, index: number, total: number): string {
  return total > 1 ? `${name}, view ${index + 1} of ${total}` : name;
}
