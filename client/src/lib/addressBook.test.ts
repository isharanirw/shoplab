import { describe, expect, it } from 'vitest';
import type { Country, SavedAddress } from '../api/types';
import { addressSummary, bookPayload, EMPTY_BOOK_FORM, formFromAddress, validateBookForm } from './addressBook';

const countries: Country[] = [
  { code: 'SE', name: 'Sweden', postalPattern: '^\\d{5}$', postalHint: '5 digits', regions: [{ code: 'AB', name: 'Stockholm' }] },
  { code: 'IN', name: 'India', postalPattern: '^\\d{6}$', postalHint: '6 digits', regions: [{ code: 'MH', name: 'Maharashtra' }] },
];

const saved: SavedAddress = {
  id: 1,
  label: 'Home',
  firstName: 'Casey',
  lastName: 'Customer',
  street: 'Sveavagen 12',
  city: 'Stockholm',
  regionCode: 'AB',
  regionName: 'Stockholm',
  countryCode: 'SE',
  countryName: 'Sweden',
  postalCode: '11157',
  phone: '+46 8 123 456',
  isDefault: true,
};

describe('validateBookForm', () => {
  it('accepts a saved address converted to a form', () => {
    expect(validateBookForm(formFromAddress(saved), countries)).toEqual({});
  });

  it('applies the per-country postal code rule', () => {
    const form = { ...formFromAddress(saved), postalCode: '1115' };
    expect(validateBookForm(form, countries).postalCode).toContain('5 digits');
    const india = { ...form, countryCode: 'IN', regionCode: 'MH', postalCode: '40001' };
    expect(validateBookForm(india, countries).postalCode).toContain('6 digits');
    expect(validateBookForm({ ...india, postalCode: '400001' }, countries)).toEqual({});
  });

  it('requires the checkout fields but not label or city', () => {
    const errors = validateBookForm(EMPTY_BOOK_FORM, countries);
    expect(Object.keys(errors).sort()).toEqual(['countryCode', 'firstName', 'lastName', 'phone', 'postalCode', 'regionCode', 'street']);
  });

  it('limits label and city length', () => {
    const errors = validateBookForm({ ...formFromAddress(saved), label: 'x'.repeat(31), city: 'y'.repeat(61) }, countries);
    expect(errors.label).toBeDefined();
    expect(errors.city).toBeDefined();
  });
});

describe('bookPayload and addressSummary', () => {
  it('trims text and leaves out isDefault (the radio sets that)', () => {
    const payload = bookPayload({ ...formFromAddress(saved), label: ' Home ', street: ' Sveavagen 12 ' });
    expect(payload).toMatchObject({ label: 'Home', street: 'Sveavagen 12', postalCode: '11157' });
    expect(payload).not.toHaveProperty('isDefault');
  });

  it('summarises an address on one line and skips an empty city', () => {
    expect(addressSummary(saved)).toBe('Sveavagen 12, Stockholm, Stockholm, 11157, Sweden');
    expect(addressSummary({ ...saved, city: '' })).toBe('Sveavagen 12, Stockholm, 11157, Sweden');
  });
});
