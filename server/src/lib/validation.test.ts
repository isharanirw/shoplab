import { describe, expect, it } from 'vitest';
import { normaliseEmail, validateEmail, validateName, validateRegistration } from './validation';

const valid = {
  name: 'Jane Tester',
  email: 'jane@example.test',
  password: 'Test@1234',
  confirmPassword: 'Test@1234',
  acceptTerms: true,
};

describe('validateRegistration', () => {
  it('accepts a complete valid body', () => {
    expect(validateRegistration(valid)).toEqual({});
  });

  it('flags every missing field', () => {
    expect(Object.keys(validateRegistration({})).sort()).toEqual([
      'acceptTerms',
      'confirmPassword',
      'email',
      'name',
      'password',
    ]);
  });

  it('flags a password mismatch on the confirm field', () => {
    expect(validateRegistration({ ...valid, confirmPassword: 'Test@12345' })).toEqual({
      confirmPassword: 'Passwords do not match.',
    });
  });

  it('flags a weak password on the password field', () => {
    expect(validateRegistration({ ...valid, password: 'weak', confirmPassword: 'weak' })).toHaveProperty('password');
  });

  it('requires the terms to be accepted with a real boolean true', () => {
    expect(validateRegistration({ ...valid, acceptTerms: 'true' })).toHaveProperty('acceptTerms');
    expect(validateRegistration({ ...valid, acceptTerms: false })).toHaveProperty('acceptTerms');
  });
});

describe('validateEmail / validateName / normaliseEmail', () => {
  it('accepts normal addresses and rejects malformed ones', () => {
    expect(validateEmail('a@b.co')).toBeNull();
    expect(validateEmail('no-at-sign')).not.toBeNull();
    expect(validateEmail('a@b')).not.toBeNull();
    expect(validateEmail('a b@c.com')).not.toBeNull();
    expect(validateEmail('   ')).not.toBeNull();
  });

  it('limits name length after trimming', () => {
    expect(validateName(' A ')).not.toBeNull();
    expect(validateName('Al')).toBeNull();
    expect(validateName('x'.repeat(61))).not.toBeNull();
  });

  it('lowercases and trims emails', () => {
    expect(normaliseEmail('  Customer1@ShopLab.TEST ')).toBe('customer1@shoplab.test');
  });
});
