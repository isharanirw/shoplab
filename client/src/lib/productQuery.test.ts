import { describe, expect, it } from 'vitest';
import { EMPTY_FILTERS, hasActiveFilters, hasCategory, parseFilters, priceRangeError, toApiQuery, toSearchParams, toggleCategory } from './productQuery';

const parse = (qs: string) => parseFilters(new URLSearchParams(qs));

describe('parseFilters', () => {
  it('returns the defaults for an empty query string', () => {
    expect(parse('')).toEqual(EMPTY_FILTERS);
  });

  it('reads every filter', () => {
    expect(parse('q=lamp&category=Home&category=Toys&subcategory=Kitchen&minPrice=10&maxPrice=49.99&inStock=true&rating=4&sort=price_asc&page=3')).toEqual({
      q: 'lamp',
      categories: ['Home', 'Toys'],
      subcategory: 'Kitchen',
      minPrice: '10',
      maxPrice: '49.99',
      inStock: true,
      rating: 4,
      sort: 'price_asc',
      page: 3,
    });
  });

  it('accepts comma separated categories and drops duplicates', () => {
    expect(parse('category=Home,Toys&category=Home').categories).toEqual(['Home', 'Toys']);
  });

  it('ignores invalid values instead of failing', () => {
    expect(parse('page=0').page).toBe(1);
    expect(parse('page=abc').page).toBe(1);
    expect(parse('rating=9').rating).toBeNull();
    expect(parse('sort=cheapest').sort).toBe('');
    expect(parse('minPrice=-5&maxPrice=abc')).toMatchObject({ minPrice: '', maxPrice: '' });
    expect(parse('inStock=yes').inStock).toBe(false);
  });
});

describe('toSearchParams', () => {
  it('leaves out defaults', () => {
    expect(toSearchParams(EMPTY_FILTERS).toString()).toBe('');
    expect(toSearchParams({ ...EMPTY_FILTERS, page: 1 }).toString()).toBe('');
  });

  it('round-trips through parseFilters', () => {
    const filters = {
      q: 'smart lamp',
      categories: ['Electronics', 'Home'],
      subcategory: '',
      minPrice: '5',
      maxPrice: '100.50',
      inStock: true,
      rating: 3,
      sort: 'newest' as const,
      page: 2,
    };
    expect(parseFilters(toSearchParams(filters))).toEqual(filters);
  });

  it('writes repeated category parameters and page only when above 1', () => {
    const qs = toSearchParams({ ...EMPTY_FILTERS, categories: ['Home', 'Toys'], page: 2 }).toString();
    expect(qs).toBe('category=Home&category=Toys&page=2');
  });
});

describe('toApiQuery', () => {
  it('adds the page size', () => {
    expect(toApiQuery({ ...EMPTY_FILTERS, sort: 'rating' })).toBe('sort=rating&pageSize=12');
  });
});

describe('priceRangeError', () => {
  it('accepts empty and valid ranges', () => {
    expect(priceRangeError('', '')).toBeNull();
    expect(priceRangeError('10', '')).toBeNull();
    expect(priceRangeError('10', '10')).toBeNull();
    expect(priceRangeError('9.99', '50')).toBeNull();
  });
  it('rejects min above max and malformed amounts', () => {
    expect(priceRangeError('50', '10')).toMatch(/cannot be higher/);
    expect(priceRangeError('abc', '')).toMatch(/minimum/);
    expect(priceRangeError('', '-1')).toMatch(/maximum/);
    expect(priceRangeError('1.234', '')).toMatch(/minimum/);
  });
});

describe('helpers', () => {
  it('detects active filters but not sort or page', () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, sort: 'rating', page: 4 })).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, inStock: true })).toBe(true);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, q: 'x' })).toBe(true);
  });
  it('toggles a category on and off', () => {
    expect(toggleCategory(['Home'], 'Toys')).toEqual(['Home', 'Toys']);
    expect(toggleCategory(['Home', 'Toys'], 'Home')).toEqual(['Toys']);
    expect(toggleCategory(['home', 'Toys'], 'Home')).toEqual(['Toys']);
    expect(hasCategory(['electronics'], 'Electronics')).toBe(true);
  });
});
