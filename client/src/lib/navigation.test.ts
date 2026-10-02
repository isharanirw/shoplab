import { describe, expect, it } from 'vitest';
import { loginPathFor, safeNext } from './navigation';

describe('safeNext', () => {
  it('keeps same-site paths, including query strings', () => {
    expect(safeNext('/account/orders')).toBe('/account/orders');
    expect(safeNext('/products?page=2&sort=price')).toBe('/products?page=2&sort=price');
  });

  it('falls back to /account for empty or external targets', () => {
    expect(safeNext(null)).toBe('/account');
    expect(safeNext('')).toBe('/account');
    expect(safeNext('https://evil.example')).toBe('/account');
    expect(safeNext('//evil.example')).toBe('/account');
    expect(safeNext('/\\evil.example')).toBe('/account');
    expect(safeNext('account')).toBe('/account');
  });

  it('avoids redirect loops back to the login page', () => {
    expect(safeNext('/login?next=/account')).toBe('/account');
  });
});

describe('loginPathFor', () => {
  it('encodes the target path', () => {
    expect(loginPathFor('/account/orders?page=2')).toBe('/login?next=%2Faccount%2Forders%3Fpage%3D2');
  });
});
