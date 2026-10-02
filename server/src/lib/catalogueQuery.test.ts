import { describe, expect, it } from 'vitest';
import { ApiError } from './errors';
import { parseIdParam, parseProductQuery, parseReviewQuery, parseSuggestQuery } from './catalogueQuery';
import type { CategoryInfo } from './catalogueQuery';

const known: CategoryInfo[] = [
  { name: 'Electronics', subcategories: ['Audio', 'Accessories'] },
  { name: 'Home', subcategories: ['Kitchen'] },
];

function fieldErrorsOf(fn: () => unknown): Record<string, string> {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(ApiError);
    const apiErr = err as ApiError;
    expect(apiErr.code).toBe('VALIDATION_ERROR');
    expect(apiErr.status).toBe(400);
    return apiErr.fieldErrors ?? {};
  }
  throw new Error('Expected a validation error');
}

describe('parseProductQuery', () => {
  it('applies defaults', () => {
    expect(parseProductQuery({}, known)).toEqual({
      q: '',
      categories: [],
      subcategory: null,
      minPriceCents: null,
      maxPriceCents: null,
      inStock: false,
      minRating: null,
      featured: false,
      sort: null,
      page: 1,
      pageSize: 12,
    });
  });

  it('parses every filter', () => {
    const q = parseProductQuery(
      { q: '  lamp ', category: ['electronics', 'Home'], minPrice: '10', maxPrice: '99.5', inStock: 'true', rating: '4', sort: 'price_desc', page: '3', pageSize: '24' },
      known,
    );
    expect(q).toMatchObject({
      q: 'lamp',
      categories: ['Electronics', 'Home'],
      minPriceCents: 1000,
      maxPriceCents: 9950,
      inStock: true,
      minRating: 4,
      sort: 'price_desc',
      page: 3,
      pageSize: 24,
    });
  });

  it('accepts comma separated and repeated categories, case-insensitively, without duplicates', () => {
    expect(parseProductQuery({ category: 'home,ELECTRONICS' }, known).categories).toEqual(['Home', 'Electronics']);
    expect(parseProductQuery({ category: ['Home', 'home'] }, known).categories).toEqual(['Home']);
  });

  it('treats empty values as absent', () => {
    const q = parseProductQuery({ q: '', minPrice: '', page: '', sort: '' }, known);
    expect(q.q).toBe('');
    expect(q.minPriceCents).toBeNull();
    expect(q.page).toBe(1);
    expect(q.sort).toBeNull();
  });

  it('converts dollars to cents without floating point drift', () => {
    expect(parseProductQuery({ minPrice: '0.07' }, known).minPriceCents).toBe(7);
    expect(parseProductQuery({ minPrice: '19.9' }, known).minPriceCents).toBe(1990);
    expect(parseProductQuery({ maxPrice: '0' }, known).maxPriceCents).toBe(0);
  });

  it('resolves a subcategory to its canonical name', () => {
    expect(parseProductQuery({ subcategory: 'audio' }, known).subcategory).toBe('Audio');
  });

  it('rejects bad values with field errors', () => {
    const errs = fieldErrorsOf(() =>
      parseProductQuery(
        { page: '0', pageSize: '51', minPrice: '-1', maxPrice: 'abc', rating: '6', sort: 'cheapest', inStock: 'yes', category: 'Garden', subcategory: 'Nope' },
        known,
      ),
    );
    expect(Object.keys(errs).sort()).toEqual(['category', 'inStock', 'maxPrice', 'minPrice', 'page', 'pageSize', 'rating', 'sort', 'subcategory']);
  });

  it('rejects non-numeric, fractional and repeated scalar values', () => {
    expect(fieldErrorsOf(() => parseProductQuery({ page: '1.5' }, known))).toHaveProperty('page');
    expect(fieldErrorsOf(() => parseProductQuery({ page: 'abc' }, known))).toHaveProperty('page');
    expect(fieldErrorsOf(() => parseProductQuery({ page: ['1', '2'] }, known))).toHaveProperty('page');
    expect(fieldErrorsOf(() => parseProductQuery({ minPrice: '1.234' }, known))).toHaveProperty('minPrice');
  });

  it('rejects minPrice above maxPrice', () => {
    expect(fieldErrorsOf(() => parseProductQuery({ minPrice: '50', maxPrice: '10' }, known))).toHaveProperty('minPrice');
    expect(parseProductQuery({ minPrice: '10', maxPrice: '10' }, known).minPriceCents).toBe(1000);
  });

  it('rejects an over-long search text', () => {
    expect(fieldErrorsOf(() => parseProductQuery({ q: 'x'.repeat(101) }, known))).toHaveProperty('q');
    expect(parseProductQuery({ q: 'x'.repeat(100) }, known).q).toHaveLength(100);
  });
});

describe('parseReviewQuery', () => {
  it('defaults to newest, page 1, 5 per page', () => {
    expect(parseReviewQuery({})).toEqual({ sort: 'newest', page: 1, pageSize: 5 });
  });
  it('accepts the three sort options and rejects others', () => {
    for (const sort of ['newest', 'highest', 'lowest']) expect(parseReviewQuery({ sort }).sort).toBe(sort);
    expect(fieldErrorsOf(() => parseReviewQuery({ sort: 'oldest' }))).toHaveProperty('sort');
    expect(fieldErrorsOf(() => parseReviewQuery({ page: '0' }))).toHaveProperty('page');
  });
});

describe('parseSuggestQuery and parseIdParam', () => {
  it('trims the suggest text and tolerates a missing one', () => {
    expect(parseSuggestQuery({ q: '  ab ' })).toBe('ab');
    expect(parseSuggestQuery({})).toBe('');
  });
  it('accepts only positive whole numbers as IDs', () => {
    expect(parseIdParam('12')).toBe(12);
    for (const bad of ['0', '-1', 'abc', '1.5', '', '1e3', undefined]) {
      expect(fieldErrorsOf(() => parseIdParam(bad))).toHaveProperty('id');
    }
  });
});
