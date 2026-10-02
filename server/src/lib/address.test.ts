import { describe, expect, it } from 'vitest';
import { validateAddress, validatePhone, validatePostalCode } from './address';
import type { CountryInfo } from './address';

const COUNTRIES: CountryInfo[] = [
  { code: 'SE', name: 'Sweden', postalPattern: '^\\d{5}$', postalHint: '5 digits', regions: [{ code: 'AB', name: 'Stockholm' }] },
  { code: 'US', name: 'United States', postalPattern: '^\\d{5}$', postalHint: '5 digits', regions: [{ code: 'CA', name: 'California' }] },
  { code: 'IN', name: 'India', postalPattern: '^\\d{6}$', postalHint: '6 digits', regions: [{ code: 'MH', name: 'Maharashtra' }] },
];
const [SE, US, IN] = COUNTRIES as [CountryInfo, CountryInfo, CountryInfo];

describe('postal codes per country', () => {
  it('Sweden and the US need exactly 5 digits', () => {
    for (const country of [SE, US]) {
      expect(validatePostalCode(country, '11157')).toBeNull();
      expect(validatePostalCode(country, '1115')).not.toBeNull();
      expect(validatePostalCode(country, '111577')).not.toBeNull();
      expect(validatePostalCode(country, '1115a')).not.toBeNull();
      expect(validatePostalCode(country, '111 57')).not.toBeNull();
    }
  });

  it('India needs exactly 6 digits', () => {
    expect(validatePostalCode(IN, '400001')).toBeNull();
    expect(validatePostalCode(IN, '40001')).not.toBeNull();
    expect(validatePostalCode(IN, '4000011')).not.toBeNull();
  });

  it('trims spaces, requires a value and names the rule in the message', () => {
    expect(validatePostalCode(SE, ' 11157 ')).toBeNull();
    expect(validatePostalCode(SE, '  ')).toBe('Postal code is required.');
    expect(validatePostalCode(IN, 'abc')).toBe('Postal code for India must be 6 digits.');
  });
});

describe('phone numbers', () => {
  it('accepts common formats and rejects letters or too few digits', () => {
    expect(validatePhone('+46 8 123 456')).toBeNull();
    expect(validatePhone('(206) 555-0100')).toBeNull();
    expect(validatePhone('')).not.toBeNull();
    expect(validatePhone('12345')).not.toBeNull();
    expect(validatePhone('call me maybe')).not.toBeNull();
  });
});

describe('validateAddress', () => {
  const good = {
    firstName: 'Ada',
    lastName: 'Lovelace',
    street: '1 Analytical Way',
    countryCode: 'IN',
    regionCode: 'MH',
    postalCode: '400001',
    phone: '+91 22 1234 5678',
  };

  it('accepts a complete address and trims values', () => {
    const result = validateAddress({ ...good, firstName: '  Ada ' }, COUNTRIES);
    expect(result).toMatchObject({ ok: true, address: { firstName: 'Ada', city: '', regionCode: 'MH' } });
  });

  it('checks the postal code against the chosen country', () => {
    const result = validateAddress({ ...good, postalCode: '40001' }, COUNTRIES);
    expect(result).toEqual({ ok: false, fieldErrors: { postalCode: 'Postal code for India must be 6 digits.' } });
  });

  it('requires a region that belongs to the country', () => {
    const result = validateAddress({ ...good, regionCode: 'CA' }, COUNTRIES);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.regionCode).toContain('India');
  });

  it('reports every missing field together', () => {
    const result = validateAddress({}, COUNTRIES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.fieldErrors).sort()).toEqual(['countryCode', 'firstName', 'lastName', 'phone', 'street']);
    }
  });
});
