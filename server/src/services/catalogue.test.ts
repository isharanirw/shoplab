import { beforeAll, describe, expect, it } from 'vitest';
import { loadConfig } from '../config';
import { openDatabase } from '../db/connection';
import type { Db } from '../db/connection';
import { seedDatabase } from '../db/seed';
import { parseProductQuery, parseReviewQuery } from '../lib/catalogueQuery';
import { categoryInfo, getProduct, listCategories, listProducts, listReviews, suggestProducts } from './catalogue';

let db: Db;

beforeAll(() => {
  db = openDatabase(':memory:');
  seedDatabase(db, loadConfig().seedDir);
});

function list(raw: Record<string, unknown> = {}) {
  return listProducts(db, parseProductQuery(raw, categoryInfo(db)));
}
/** Every matching product, walking all pages (the page size cap is 50). */
function every(raw: Record<string, unknown> = {}) {
  const out = [];
  for (let page = 1; ; page++) {
    const res = list({ pageSize: '50', ...raw, page: String(page) });
    out.push(...res.data);
    if (out.length >= res.total) return out;
  }
}
function ids(raw: Record<string, unknown> = {}) {
  return every(raw).map((p) => p.id);
}
const effective = (p: { priceCents: number; salePriceCents: number | null }) => p.salePriceCents ?? p.priceCents;

describe('pagination', () => {
  it('returns 12 of 60 by default in the standard list shape', () => {
    const res = list();
    expect(res).toMatchObject({ page: 1, pageSize: 12, total: 60 });
    expect(res.data).toHaveLength(12);
    expect(res.data.map((p) => p.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('serves the last page and an empty page beyond it, keeping the total', () => {
    expect(list({ page: '5' }).data.map((p) => p.id)).toEqual([49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60]);
    const beyond = list({ page: '6' });
    expect(beyond).toMatchObject({ data: [], page: 6, total: 60 });
  });

  it('honours pageSize and does not repeat items across pages', () => {
    const seen = new Set<number>();
    for (let page = 1; page <= 6; page++) {
      for (const p of list({ pageSize: '10', page: String(page) }).data) seen.add(p.id);
    }
    expect(seen.size).toBe(60);
  });
});

describe('search', () => {
  it('matches a case-insensitive substring of the name', () => {
    expect(ids({ q: 'smart lamp' })).toEqual([4, 23]);
    expect(ids({ q: 'LAMP' })).toEqual([4, 23]);
    expect(ids({ q: 'mp' }).length).toBeGreaterThan(2);
  });

  it('does not match on category, description or wildcard characters', () => {
    expect(ids({ q: 'Electronics' })).toEqual([]);
    expect(ids({ q: '%' })).toEqual([]);
    expect(ids({ q: '_' })).toEqual([]);
  });

  it('returns an empty list with total 0 when nothing matches', () => {
    expect(list({ q: 'zzzz-no-such-product' })).toEqual({ data: [], page: 1, pageSize: 12, total: 0 });
  });
});

describe('category filters', () => {
  it('filters by one category and by several at once', () => {
    const electronics = list({ category: 'Electronics', pageSize: '50' }).data;
    expect(electronics.length).toBe(10);
    expect(electronics.every((p) => p.category === 'Electronics')).toBe(true);
    const both = list({ category: ['Electronics', 'Books'], pageSize: '50' });
    expect(new Set(both.data.map((p) => p.category))).toEqual(new Set(['Electronics', 'Books']));
    expect(both.total).toBe(10 + 10);
  });

  it('filters by subcategory, which can repeat across categories', () => {
    expect(ids({ category: 'Electronics', subcategory: 'Accessories' }).length).toBe(3);
    expect(ids({ subcategory: 'Accessories' }).length).toBe(6);
    expect(ids({ category: 'Toys', subcategory: 'Audio' })).toEqual([]);
  });
});

describe('price filters use the sale price when there is one', () => {
  it('applies min and max inclusively', () => {
    const res = list({ minPrice: '20', maxPrice: '50', pageSize: '50' }).data;
    expect(res.length).toBeGreaterThan(0);
    for (const p of res) {
      expect(effective(p)).toBeGreaterThanOrEqual(2000);
      expect(effective(p)).toBeLessThanOrEqual(5000);
    }
  });

  it('counts a product on sale at its sale price', () => {
    // Product 2: $49.99 regular, $39.99 on sale.
    expect(ids({ maxPrice: '39.99' })).toContain(2);
    expect(ids({ minPrice: '40' })).not.toContain(2);
    expect(ids({ minPrice: '39.99', maxPrice: '39.99' })).toContain(2);
  });
});

describe('stock', () => {
  it('inStock hides products whose total stock is zero, including variant-only stock-outs', () => {
    const all = ids();
    const inStock = ids({ inStock: 'true' });
    for (const soldOut of [7, 18, 29, 46, 53, 58]) {
      expect(all).toContain(soldOut);
      expect(inStock).not.toContain(soldOut);
    }
    expect(inStock.length).toBe(54);
  });

  it('keeps a variant product that still has some variant in stock', () => {
    expect(ids({ inStock: 'true' })).toContain(13);
  });

  it('inStock=false is the same as no filter', () => {
    expect(ids({ inStock: 'false' })).toEqual(ids());
  });
});

describe('rating filter', () => {
  it('keeps only products whose displayed average is at least the minimum', () => {
    const res = list({ rating: '4', pageSize: '50' }).data;
    expect(res.length).toBeGreaterThan(0);
    for (const p of res) expect(p.rating.average).toBeGreaterThanOrEqual(4);
  });

  it('excludes products with no reviews', () => {
    expect(ids({ rating: '1' })).not.toContain(60);
    expect(ids({ rating: '1' }).length).toBe(59);
    expect(ids({ rating: '1' }).length + 1).toBe(list().total);
  });

  it('rounds the average half up to one decimal before comparing', () => {
    // Product 1 has 28 reviews averaging 3.96, which displays and filters as 4.0.
    expect(getProduct(db, 1)?.rating.average).toBe(4);
    expect(ids({ rating: '4' })).toContain(1);
  });

  it('is cumulative: each higher minimum returns a subset', () => {
    const counts = [1, 2, 3, 4, 5].map((r) => ids({ rating: String(r) }).length);
    for (let i = 1; i < counts.length; i++) expect(counts[i]!).toBeLessThanOrEqual(counts[i - 1]!);
  });
});

describe('combined filters and featured', () => {
  it('ANDs filters together', () => {
    const res = list({ category: 'Home', inStock: 'true', rating: '3', maxPrice: '100', pageSize: '50' }).data;
    for (const p of res) {
      expect(p.category).toBe('Home');
      expect(p.inStock).toBe(true);
      expect(p.rating.average).toBeGreaterThanOrEqual(3);
      expect(effective(p)).toBeLessThanOrEqual(10000);
    }
  });

  it('returns the 8 featured products', () => {
    expect(ids({ featured: 'true' })).toEqual([1, 2, 13, 22, 27, 31, 33, 52]);
  });
});

describe('sorting', () => {
  it('sorts by price ascending and descending using the sale price', () => {
    const asc = every({ sort: 'price_asc' }).map(effective);
    expect(asc).toEqual([...asc].sort((a, b) => a - b));
    expect(asc[0]).toBe(500);
    const desc = every({ sort: 'price_desc' }).map(effective);
    expect(desc).toEqual([...desc].sort((a, b) => b - a));
    expect(desc[0]).toBe(49900);
  });

  it('breaks price ties by ID so the order is stable', () => {
    const res = every({ sort: 'price_asc' });
    for (let i = 1; i < res.length; i++) {
      const a = res[i - 1]!;
      const b = res[i]!;
      if (effective(a) === effective(b)) expect(b.id).toBeGreaterThan(a.id);
    }
  });

  it('sorts by rating, highest first, with unrated products last', () => {
    const res = every({ sort: 'rating' });
    const averages = res.map((p) => p.rating.average ?? -1);
    expect(averages).toEqual([...averages].sort((a, b) => b - a));
    expect(res[res.length - 1]!.id).toBe(60);
  });

  it('sorts newest first', () => {
    const res = every({ sort: 'newest' }).map((p) => p.createdAt);
    expect(res).toEqual([...res].sort().reverse());
  });

  it('sorts across pages, not just within one page', () => {
    const page1 = list({ sort: 'price_desc', page: '1' }).data.map(effective);
    const page2 = list({ sort: 'price_desc', page: '2' }).data.map(effective);
    expect(Math.min(...page1)).toBeGreaterThanOrEqual(Math.max(...page2));
  });
});

describe('suggest', () => {
  it('returns nothing for fewer than 2 characters', () => {
    expect(suggestProducts(db, 'a')).toEqual({ data: [], page: 1, pageSize: 5, total: 0 });
    expect(suggestProducts(db, ' a ').data).toEqual([]);
    expect(suggestProducts(db, '').data).toEqual([]);
  });

  it('returns at most 5 but reports the full match count', () => {
    const res = suggestProducts(db, 'er');
    expect(res.data).toHaveLength(5);
    expect(res.total).toBeGreaterThan(5);
  });

  it('puts names that start with the text first, then other matches', () => {
    // "Smartphone Case" (9) and both "Smart Lamp" products start with "smart".
    expect(suggestProducts(db, 'smart').data.map((s) => s.id)).toEqual([4, 9, 23]);
    // "lamp" is a prefix of nothing, so every match is a non-prefix match, in ID order.
    expect(suggestProducts(db, 'lamp').data.map((s) => s.id)).toEqual([4, 23]);
    // "ca" starts "Cast Iron Skillet" and others; prefix matches must come before the rest.
    const mixed = suggestProducts(db, 'ca');
    const firstNonPrefix = mixed.data.findIndex((s) => !s.name.toLowerCase().startsWith('ca'));
    if (firstNonPrefix !== -1) {
      expect(mixed.data.slice(firstNonPrefix).every((s) => !s.name.toLowerCase().startsWith('ca'))).toBe(true);
    }
  });

  it('includes the category so same-named products can be told apart', () => {
    expect(suggestProducts(db, 'Smart Lamp').data).toEqual([
      { id: 4, name: 'Smart Lamp', category: 'Electronics' },
      { id: 23, name: 'Smart Lamp', category: 'Home' },
    ]);
  });

  it('is case-insensitive and returns nothing when there is no match', () => {
    expect(suggestProducts(db, 'SMART LAMP').data).toHaveLength(2);
    expect(suggestProducts(db, 'qqqq').data).toEqual([]);
  });
});

describe('product detail', () => {
  it('returns variants with stock and a rating summary', () => {
    const p = getProduct(db, 13)!;
    expect(p.variants).toHaveLength(8);
    expect(p.hasVariants).toBe(true);
    expect(p.stock).toBe(p.variants.reduce((sum, v) => sum + v.stock, 0));
    expect(p.specs.length).toBeGreaterThan(0);
    expect(p.rating.count).toBe(6);
    expect(Object.values(p.ratingDistribution).reduce((a, b) => a + b, 0)).toBe(6);
  });

  it('shows a product with every variant sold out as out of stock', () => {
    const p = getProduct(db, 18)!;
    expect(p.inStock).toBe(false);
    expect(p.variants.every((v) => v.stock === 0)).toBe(true);
  });

  it('has no rating for a product without reviews', () => {
    expect(getProduct(db, 60)!.rating).toEqual({ average: null, count: 0 });
  });

  it('returns null for an unknown product', () => {
    expect(getProduct(db, 999)).toBeNull();
  });
});

describe('reviews', () => {
  const page = (productId: number, raw: Record<string, unknown> = {}) => listReviews(db, productId, parseReviewQuery(raw))!;

  it('pages product 1 (28 reviews) five at a time: 6 pages, the last with 3', () => {
    expect(page(1)).toMatchObject({ page: 1, pageSize: 5, total: 28 });
    expect(page(1).data).toHaveLength(5);
    expect(page(1, { page: '6' }).data).toHaveLength(3);
    expect(page(1, { page: '7' }).data).toEqual([]);
  });

  it('sorts newest first by default', () => {
    const dates = page(1).data.map((r) => r.createdAt);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it('sorts by highest and lowest rating', () => {
    expect(page(1, { sort: 'highest' }).data.every((r) => r.rating === 5)).toBe(true);
    const lowest = page(1, { sort: 'lowest' }).data.map((r) => r.rating);
    expect(lowest).toEqual([...lowest].sort((a, b) => a - b));
    expect(lowest[0]).toBe(1);
  });

  it('sorts across the whole set, not within a page', () => {
    const seen: number[] = [];
    for (let p = 1; p <= 6; p++) seen.push(...page(1, { sort: 'highest', page: String(p) }).data.map((r) => r.rating));
    expect(seen).toEqual([...seen].sort((a, b) => b - a));
    expect(seen).toHaveLength(28);
  });

  it('returns an empty list for a product with no reviews and null for an unknown product', () => {
    expect(page(60)).toEqual({ data: [], page: 1, pageSize: 5, total: 0 });
    expect(listReviews(db, 999, parseReviewQuery({}))).toBeNull();
  });
});

describe('categories', () => {
  it('lists the six categories in storefront order with subcategories and counts', () => {
    const cats = listCategories(db);
    expect(cats.map((c) => c.name)).toEqual(['Electronics', 'Clothing', 'Home', 'Sports', 'Books', 'Toys']);
    expect(cats.reduce((sum, c) => sum + c.productCount, 0)).toBe(60);
    for (const c of cats) {
      expect(c.subcategories.reduce((sum, s) => sum + s.productCount, 0)).toBe(c.productCount);
      const names = c.subcategories.map((s) => s.name);
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    }
  });
});
