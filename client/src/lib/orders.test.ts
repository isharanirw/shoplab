import { describe, expect, it } from 'vitest';
import { ariaSortFor, nextSort, orderListApiPath, orderListSearch, parseOrderListState } from './orders';

const parse = (query: string) => parseOrderListState(new URLSearchParams(query));

describe('parseOrderListState', () => {
  it('uses defaults for an empty query', () => {
    expect(parse('')).toEqual({ status: null, sort: 'date_desc', page: 1 });
  });

  it('reads status, sort and page', () => {
    expect(parse('status=Shipped&sort=total_asc&page=3')).toEqual({ status: 'Shipped', sort: 'total_asc', page: 3 });
  });

  it('ignores invalid values', () => {
    expect(parse('status=shipped&sort=cheapest&page=0')).toEqual({ status: null, sort: 'date_desc', page: 1 });
    expect(parse('page=abc')).toMatchObject({ page: 1 });
    expect(parse('page=2.5')).toMatchObject({ page: 1 });
  });
});

describe('orderListSearch', () => {
  it('leaves defaults out', () => {
    expect(orderListSearch({ status: null, sort: 'date_desc', page: 1 })).toBe('');
  });

  it('round-trips through the parser', () => {
    const state = { status: 'Delivered' as const, sort: 'total_desc' as const, page: 2 };
    expect(orderListSearch(state)).toBe('?status=Delivered&sort=total_desc&page=2');
    expect(parse(orderListSearch(state))).toEqual(state);
  });
});

describe('orderListApiPath', () => {
  it('always sends sort, page and a page size of 5', () => {
    expect(orderListApiPath({ status: null, sort: 'date_desc', page: 1 })).toBe('/api/orders?sort=date_desc&page=1&pageSize=5');
    expect(orderListApiPath({ status: 'Cancelled', sort: 'total_asc', page: 4 })).toBe(
      '/api/orders?sort=total_asc&page=4&pageSize=5&status=Cancelled',
    );
  });
});

describe('column sorting', () => {
  it('flips the order of the current column and starts a new column in descending order', () => {
    expect(nextSort('date_desc', 'date')).toBe('date_asc');
    expect(nextSort('date_asc', 'date')).toBe('date_desc');
    expect(nextSort('date_desc', 'total')).toBe('total_desc');
    expect(nextSort('total_desc', 'total')).toBe('total_asc');
    expect(nextSort('total_asc', 'date')).toBe('date_desc');
  });

  it('reports aria-sort for the active column only', () => {
    expect(ariaSortFor('date_desc', 'date')).toBe('descending');
    expect(ariaSortFor('total_asc', 'total')).toBe('ascending');
    expect(ariaSortFor('total_asc', 'date')).toBe('none');
  });
});
