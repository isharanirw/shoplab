export interface ListResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface RatingSummary {
  average: number | null;
  count: number;
}

export interface ProductSummary {
  id: number;
  name: string;
  category: string;
  subcategory: string;
  priceCents: number;
  salePriceCents: number | null;
  stock: number;
  inStock: boolean;
  hasVariants: boolean;
  featured: boolean;
  imageCount: number;
  rating: RatingSummary;
  createdAt: string;
}

export interface Variant {
  id: number;
  size: string | null;
  colour: string | null;
  stock: number;
}

export interface ProductDetail extends ProductSummary {
  description: string;
  specs: { label: string; value: string }[];
  variants: Variant[];
  ratingDistribution: Record<'1' | '2' | '3' | '4' | '5', number>;
}

export interface Review {
  id: number;
  authorName: string;
  rating: number;
  title: string;
  body: string;
  imagePath: string | null;
  createdAt: string;
}

export interface Suggestion {
  id: number;
  name: string;
  category: string;
}

export interface CategoryNode {
  name: string;
  productCount: number;
  subcategories: { name: string; productCount: number }[];
}

export interface Promotions {
  bannerText: string;
  flashSaleLabel: string;
}
