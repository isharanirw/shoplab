/**
 * The fixed catalogue taxonomy: the six categories and their subcategories, in storefront order.
 * Admin product forms choose from it, so a new product can never invent a category the storefront
 * filters would reject. A unit test checks that every seeded product fits.
 */
export const TAXONOMY: Record<string, readonly string[]> = {
  Electronics: ['Accessories', 'Audio', 'Cameras', 'Computers', 'Smart Home'],
  Clothing: ['Accessories', 'Bottoms', 'Dresses', 'Outerwear', 'Sleepwear', 'Tops'],
  Home: ['Appliances', 'Bedroom', 'Decor', 'Kitchen', 'Lighting'],
  Sports: ['Cycling', 'Fitness', 'Footwear', 'Outdoors', 'Racquet Sports', 'Team Sports'],
  Books: ['Children', 'Cooking', 'Fiction', 'Non-fiction', 'Technology'],
  Toys: ['Building', 'Creative', 'Educational', 'Electronic Toys', 'Games', 'Puzzles', 'Soft Toys'],
};

export const CATEGORY_NAMES = Object.keys(TAXONOMY);

/** The canonical spelling of a category (matched ignoring case), or null. */
export function findCategory(value: string): string | null {
  const wanted = value.trim().toLowerCase();
  return CATEGORY_NAMES.find((c) => c.toLowerCase() === wanted) ?? null;
}

/** The canonical spelling of a subcategory of the given (canonical) category, or null. */
export function findSubcategory(category: string, value: string): string | null {
  const wanted = value.trim().toLowerCase();
  return TAXONOMY[category]?.find((s) => s.toLowerCase() === wanted) ?? null;
}

/** The subcategory used when none is given: the first one alphabetically. */
export function defaultSubcategory(category: string): string {
  return [...(TAXONOMY[category] ?? [])].sort((a, b) => a.localeCompare(b))[0] ?? 'General';
}
