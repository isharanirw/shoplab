import { describe, expect, it } from 'vitest';
import { adminListApiPath, adminListSearch, ORDERS_LIST, parseAdminListState, PRODUCTS_LIST, USERS_LIST } from './adminList';

const params = (text: string) => new URLSearchParams(text);

describe('admin list state', () => {
  it('reads search, filter and page from the URL', () => {
    expect(parseAdminListState(params('q=lamp&active=false&page=3'), PRODUCTS_LIST)).toEqual({ q: 'lamp', filter: 'false', page: 3 });
    expect(parseAdminListState(params('status=Shipped&page=2'), ORDERS_LIST)).toEqual({ q: '', filter: 'Shipped', page: 2 });
  });

  it('falls back to the defaults for invalid values and ignores parameters the table does not have', () => {
    expect(parseAdminListState(params('active=maybe&page=0'), PRODUCTS_LIST)).toEqual({ q: '', filter: '', page: 1 });
    expect(parseAdminListState(params('page=abc'), PRODUCTS_LIST).page).toBe(1);
    expect(parseAdminListState(params('q=x&status=Shipped'), ORDERS_LIST)).toEqual({ q: '', filter: 'Shipped', page: 1 });
    expect(parseAdminListState(params('active=true'), USERS_LIST).filter).toBe('');
  });

  it('leaves default values out of the page URL', () => {
    expect(adminListSearch({ q: '', filter: '', page: 1 }, PRODUCTS_LIST)).toBe('');
    expect(adminListSearch({ q: ' lamp ', filter: 'true', page: 2 }, PRODUCTS_LIST)).toBe('?q=lamp&active=true&page=2');
    expect(adminListSearch({ q: 'x', filter: 'Shipped', page: 1 }, ORDERS_LIST)).toBe('?q=x&status=Shipped');
  });

  it('builds the API request with the page size', () => {
    expect(adminListApiPath('/api/admin/products', { q: 'a b', filter: 'false', page: 2 }, PRODUCTS_LIST)).toBe(
      '/api/admin/products?page=2&pageSize=10&q=a+b&active=false',
    );
    expect(adminListApiPath('/api/admin/users', { q: '', filter: '', page: 1 }, USERS_LIST)).toBe('/api/admin/users?page=1&pageSize=10');
  });
});
