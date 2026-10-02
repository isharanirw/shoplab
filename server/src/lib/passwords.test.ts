import { describe, expect, it } from 'vitest';
import { hashPassword, validatePassword, verifyPassword } from './passwords';

describe('validatePassword', () => {
  it('accepts a password that meets every rule', () => {
    expect(validatePassword('Test@1234')).toBeNull();
    expect(validatePassword('Admin@1234')).toBeNull();
  });

  it('rejects passwords shorter than 8 characters', () => {
    expect(validatePassword('Ab1@xyz')).toMatch(/at least 8/);
  });

  it('accepts exactly 8 characters', () => {
    expect(validatePassword('Ab1@xyzq')).toBeNull();
  });

  it('requires an uppercase letter', () => {
    expect(validatePassword('test@1234')).toMatch(/uppercase/);
  });

  it('requires a digit', () => {
    expect(validatePassword('Test@abcd')).toMatch(/digit/);
  });

  it('requires a symbol', () => {
    expect(validatePassword('Test12345')).toMatch(/symbol/);
  });

  it('treats a space or underscore as a symbol', () => {
    expect(validatePassword('Test 1234')).toBeNull();
    expect(validatePassword('Test_1234')).toBeNull();
  });

  it('reports the length rule first when several rules fail', () => {
    expect(validatePassword('abc')).toMatch(/at least 8/);
  });
});

describe('password hashing', () => {
  it('verifies the right password and rejects a wrong one', () => {
    const hash = hashPassword('Test@1234');
    expect(hash).not.toContain('Test@1234');
    expect(verifyPassword('Test@1234', hash)).toBe(true);
    expect(verifyPassword('Test@12345', hash)).toBe(false);
  });
});
