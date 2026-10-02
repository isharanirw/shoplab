import type { Country } from '../api/types';

export interface AddressForm {
  firstName: string;
  lastName: string;
  street: string;
  countryCode: string;
  regionCode: string;
  postalCode: string;
  phone: string;
}

export const EMPTY_ADDRESS: AddressForm = {
  firstName: '',
  lastName: '',
  street: '',
  countryCode: '',
  regionCode: '',
  postalCode: '',
  phone: '',
};

export type AddressErrors = Partial<Record<keyof AddressForm, string>>;

/** Postal code rule per country (5 digits for Sweden and the US, 6 for India), from the API's pattern. */
export function validatePostalCode(country: Country | undefined, value: string): string | null {
  const code = value.trim();
  if (code === '') return 'Postal code is required.';
  if (!country) return 'Choose a country first.';
  if (!new RegExp(country.postalPattern).test(code)) return `Postal code for ${country.name} must be ${country.postalHint}.`;
  return null;
}

export function validatePhone(value: string): string | null {
  const phone = value.trim();
  if (phone === '') return 'Phone number is required.';
  if (!/^[0-9 ()+-]+$/.test(phone)) return 'Phone number can only contain digits, spaces, + - and parentheses.';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return 'Phone number must have 7 to 15 digits.';
  return null;
}

function required(value: string, label: string, min: number, max: number): string | null {
  const text = value.trim();
  if (text === '') return `${label} is required.`;
  if (text.length < min) return `${label} must be at least ${min} characters.`;
  if (text.length > max) return `${label} must be at most ${max} characters.`;
  return null;
}

/** Validates one field of the new-address form (used on blur and on Next). */
export function validateAddressField(field: keyof AddressForm, form: AddressForm, countries: Country[]): string | null {
  const country = countries.find((c) => c.code === form.countryCode);
  switch (field) {
    case 'firstName':
      return required(form.firstName, 'First name', 1, 60);
    case 'lastName':
      return required(form.lastName, 'Last name', 1, 60);
    case 'street':
      return required(form.street, 'Street', 3, 100);
    case 'countryCode':
      return country ? null : 'Choose a country.';
    case 'regionCode':
      if (!country) return 'Choose a country first.';
      return country.regions.some((r) => r.code === form.regionCode) ? null : `Choose a region in ${country.name}.`;
    case 'postalCode':
      return validatePostalCode(country, form.postalCode);
    case 'phone':
      return validatePhone(form.phone);
  }
}

export function validateAddressForm(form: AddressForm, countries: Country[]): AddressErrors {
  const errors: AddressErrors = {};
  for (const field of Object.keys(EMPTY_ADDRESS) as (keyof AddressForm)[]) {
    const message = validateAddressField(field, form, countries);
    if (message) errors[field] = message;
  }
  return errors;
}
