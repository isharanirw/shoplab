import type { SavedAddress } from '../api/types';
import { EMPTY_ADDRESS, validateAddressForm } from './address';
import type { AddressErrors, AddressForm } from './address';

export interface BookForm extends AddressForm {
  label: string;
  city: string;
  isDefault: boolean;
}

export type BookErrors = AddressErrors & { label?: string; city?: string };

export const EMPTY_BOOK_FORM: BookForm = { ...EMPTY_ADDRESS, label: '', city: '', isDefault: false };

export function formFromAddress(a: SavedAddress): BookForm {
  return {
    label: a.label,
    firstName: a.firstName,
    lastName: a.lastName,
    street: a.street,
    city: a.city,
    countryCode: a.countryCode,
    regionCode: a.regionCode,
    postalCode: a.postalCode,
    phone: a.phone,
    isDefault: a.isDefault,
  };
}

export function validateLabel(value: string): string | null {
  return value.trim().length > 30 ? 'Label must be at most 30 characters.' : null;
}

export function validateCity(value: string): string | null {
  return value.trim().length > 60 ? 'City must be at most 60 characters.' : null;
}

/** The checkout address rules plus the two extra optional fields of the address book. */
export function validateBookForm(form: BookForm, countries: Parameters<typeof validateAddressForm>[1]): BookErrors {
  const errors: BookErrors = validateAddressForm(form, countries);
  const label = validateLabel(form.label);
  if (label) errors.label = label;
  const city = validateCity(form.city);
  if (city) errors.city = city;
  return errors;
}

/** The JSON body sent to POST and PATCH /api/addresses. */
export function bookPayload(form: BookForm): Record<string, string | boolean> {
  return {
    label: form.label.trim(),
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    street: form.street.trim(),
    city: form.city.trim(),
    countryCode: form.countryCode,
    regionCode: form.regionCode,
    postalCode: form.postalCode.trim(),
    phone: form.phone.trim(),
  };
}

/** One line for an address, shared by the address book and anywhere an address is summarised. */
export function addressSummary(a: Pick<SavedAddress, 'street' | 'city' | 'regionName' | 'postalCode' | 'countryName'>): string {
  return [a.street, a.city, `${a.regionName}, ${a.postalCode}`, a.countryName].filter(Boolean).join(', ');
}
