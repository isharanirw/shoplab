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

export type ShippingMethod = 'standard' | 'express';

export interface CartItem {
  id: number;
  productId: number;
  variantId: number | null;
  name: string;
  category: string;
  imageCount: number;
  variantLabel: string | null;
  unitPriceCents: number;
  regularPriceCents: number;
  onSale: boolean;
  quantity: number;
  lineTotalCents: number;
  stock: number;
  maxQuantity: number;
  inStock: boolean;
}

export interface CartCoupon {
  code: string;
  description: string;
  applied: boolean;
  reason: 'expired' | 'below_minimum' | 'already_used' | null;
  message: string | null;
}

export interface CartTotals {
  subtotalCents: number;
  discountCents: number;
  shippingMethod: ShippingMethod;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
}

export interface Cart {
  items: CartItem[];
  itemCount: number;
  coupon: CartCoupon | null;
  totals: CartTotals;
}

export interface MergeReportItem {
  productId: number;
  variantId: number | null;
  name: string;
  requested: number;
  resulting: number;
  reason: 'unavailable' | 'out_of_stock' | 'capped';
}

export interface Quote extends Cart {
  shippingMethod: ShippingMethod;
  country: string;
  deliveryWindow: { earliest: string; latest: string };
}

export interface Region {
  code: string;
  name: string;
}

export interface Country {
  code: string;
  name: string;
  postalPattern: string;
  postalHint: string;
  regions: Region[];
}

export interface SavedAddress {
  id: number;
  label: string;
  firstName: string;
  lastName: string;
  street: string;
  city: string;
  regionCode: string;
  regionName: string;
  countryCode: string;
  countryName: string;
  postalCode: string;
  phone: string;
  isDefault: boolean;
}

export interface OrderItem {
  productId: number;
  variantId: number | null;
  name: string;
  variantLabel: string | null;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
}

export interface OrderAddress {
  firstName: string;
  lastName: string;
  street: string;
  city: string;
  regionCode: string;
  regionName: string;
  countryCode: string;
  countryName: string;
  postalCode: string;
  phone: string;
}

export interface Order {
  id: number;
  number: string;
  status: string;
  createdAt: string;
  deliveryDate: string;
  couponCode: string | null;
  shippingMethod: ShippingMethod;
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  paymentLast4: string;
  address: OrderAddress;
  items: OrderItem[];
}

export interface OrderSummary {
  id: number;
  number: string;
  status: string;
  createdAt: string;
  deliveryDate: string;
  itemCount: number;
  totalCents: number;
}

export interface ReviewEligibility {
  eligible: boolean;
  reason: 'login_required' | 'not_purchased' | 'already_reviewed' | null;
}
