import { describe, expect, it } from 'vitest';
import { validateConfirmPassword, validateEmail, validateName, validatePassword, validateTerms } from './validation';

describe('client validation', () => {
  it('applies the password rules', () => {
    expect(validatePassword('Test@1234')).toBeNull();
    expect(validatePassword('short1!')).toMatch(/8 characters/);
    expect(validatePassword('lowercase1!')).toMatch(/uppercase/);
    expect(validatePassword('NoDigits!!')).toMatch(/digit/);
    expect(validatePassword('NoSymbol12')).toMatch(/symbol/);
  });

  it('checks email shape', () => {
    expect(validateEmail('customer1@shoplab.test')).toBeNull();
    expect(validateEmail('')).toMatch(/required/);
    expect(validateEmail('nope')).toMatch(/valid/);
  });

  it('checks name length', () => {
    expect(validateName('')).toMatch(/required/);
    expect(validateName('A')).toMatch(/2 characters/);
    expect(validateName('Ann')).toBeNull();
  });

  it('checks the confirmation and terms', () => {
    expect(validateConfirmPassword('Test@1234', '')).toMatch(/confirm/);
    expect(validateConfirmPassword('Test@1234', 'Test@12345')).toMatch(/match/);
    expect(validateConfirmPassword('Test@1234', 'Test@1234')).toBeNull();
    expect(validateTerms(false)).not.toBeNull();
    expect(validateTerms(true)).toBeNull();
  });
});
