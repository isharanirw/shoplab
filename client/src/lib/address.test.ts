import { describe, expect, it } from 'vitest';
import type { Country } from '../api/types';
import { EMPTY_ADDRESS, validateAddressForm, validatePhone, validatePostalCode } from './address';

const COUNTRIES: Country[] = [
  { code: 'SE', name: 'Sweden', postalPattern: '^\\d{5}$', postalHint: '5 digits', regions: [{ code: 'AB', name: 'Stockholm' }, { code: 'M', name: 'Skane' }] },
  { code: 'US', name: 'United States', postalPattern: '^\\d{5}$', postalHint: '5 digits', regions: [{ code: 'CA', name: 'California' }] },
  { code: 'IN', name: 'India', postalPattern: '^\\d{6}$', postalHint: '6 digits', regions: [{ code: 'MH', name: 'Maharashtra' }] },
];
const [SE, US, IN] = COUNTRIES;

describe('postal code per country', () => {
  it('Sweden and the US take 5 digits, India takes 6', () => {
    expect(validatePostalCode(SE, '11157')).toBeNull();
    expect(validatePostalCode(US, '98101')).toBeNull();
    expect(validatePostalCode(IN, '400001')).toBeNull();
    expect(validatePostalCode(SE, '400001')).toBe('Postal code for Sweden must be 5 digits.');
    expect(validatePostalCode(IN, '11157')).toBe('Postal code for India must be 6 digits.');
    expect(validatePostalCode(US, '9810a')).not.toBeNull();
  });

  it('asks for a value and for a country', () => {
    expect(validatePostalCode(SE, '')).toBe('Postal code is required.');
    expect(validatePostalCode(undefined, '11157')).toBe('Choose a country first.');
  });
});

describe('address form', () => {
  const good = { firstName: 'Ada', lastName: 'Lovelace', street: '1 Analytical Way', countryCode: 'SE', regionCode: 'AB', postalCode: '11157', phone: '+46 8 123 456' };

  it('accepts a complete address', () => {
    expect(validateAddressForm(good, COUNTRIES)).toEqual({});
  });

  it('reports everything missing from an empty form', () => {
    expect(Object.keys(validateAddressForm(EMPTY_ADDRESS, COUNTRIES)).sort()).toEqual(
      ['countryCode', 'firstName', 'lastName', 'phone', 'postalCode', 'regionCode', 'street'],
    );
  });

  it('requires a region that belongs to the chosen country', () => {
    expect(validateAddressForm({ ...good, regionCode: 'CA' }, COUNTRIES).regionCode).toBe('Choose a region in Sweden.');
    expect(validateAddressForm({ ...good, countryCode: 'US', regionCode: 'CA', postalCode: '90001' }, COUNTRIES)).toEqual({});
  });

  it('checks phone numbers', () => {
    expect(validatePhone('+1 206 555 0100')).toBeNull();
    expect(validatePhone('abc')).not.toBeNull();
    expect(validatePhone('123')).toBe('Phone number must have 7 to 15 digits.');
  });
});
