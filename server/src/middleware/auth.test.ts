import { describe, expect, it } from 'vitest';
import { extractToken, SESSION_COOKIE } from './auth';

describe('extractToken', () => {
  it('reads a bearer token', () => {
    expect(extractToken('Bearer abc123', undefined)).toBe('abc123');
    expect(extractToken('bearer abc123', undefined)).toBe('abc123');
  });

  it('reads the session cookie among others', () => {
    expect(extractToken(undefined, `theme=dark; ${SESSION_COOKIE}=tok123; other=1`)).toBe('tok123');
  });

  it('prefers the bearer header when both are present', () => {
    expect(extractToken('Bearer fromheader', `${SESSION_COOKIE}=fromcookie`)).toBe('fromheader');
  });

  it('returns undefined for malformed or missing credentials', () => {
    expect(extractToken('Basic abc', undefined)).toBeUndefined();
    expect(extractToken(undefined, 'a=b')).toBeUndefined();
    expect(extractToken(undefined, undefined)).toBeUndefined();
  });
});
