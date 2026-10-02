/**
 * The catalogue categories and their subcategories, in storefront order. A copy of server/src/lib/taxonomy.ts
 * (small and stable, like the other duplicated rules); the admin product form offers these choices.
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

/** The subcategory used when the category changes: the first one alphabetically (what the API does too). */
export function defaultSubcategory(category: string): string {
  return [...(TAXONOMY[category] ?? [])].sort((a, b) => a.localeCompare(b))[0] ?? '';
}
