import { describe, expect, it } from 'vitest';
import { ApiError } from './errors';
import { parseOrderListQuery } from './orderQuery';

describe('parseOrderListQuery', () => {
  it('defaults to newest first, 5 per page, page 1, no status filter', () => {
    expect(parseOrderListQuery({})).toEqual({ status: null, sort: 'date_desc', page: 1, pageSize: 5 });
  });

  it('reads status, sort and paging', () => {
    expect(parseOrderListQuery({ status: 'Shipped', sort: 'total_asc', page: '3', pageSize: '10' })).toEqual({
      status: 'Shipped',
      sort: 'total_asc',
      page: 3,
      pageSize: 10,
    });
  });

  it('rejects unknown values with a message per parameter', () => {
    try {
      parseOrderListQuery({ status: 'shipped', sort: 'cheapest', page: '0' });
      throw new Error('expected failure');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const e = err as ApiError;
      expect(e.status).toBe(400);
      expect(Object.keys(e.fieldErrors ?? {}).sort()).toEqual(['page', 'sort', 'status']);
    }
  });
});
