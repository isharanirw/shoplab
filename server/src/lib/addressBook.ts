import { validateAddress } from './address';
import type { AddressInput, CountryInfo } from './address';

export const MAX_ADDRESSES = 10;
export const DEFAULT_LABEL = 'Address';

const ADDRESS_FIELDS = ['firstName', 'lastName', 'street', 'city', 'countryCode', 'regionCode', 'postalCode', 'phone'] as const;

export interface BookAddressInput extends AddressInput {
  label: string;
}

export type BookResult =
  | { ok: true; address: BookAddressInput; makeDefault: boolean | null }
  | { ok: false; fieldErrors: Record<string, string> };

function objectOf(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

/** Label is optional (blank means "Address"), at most 30 characters. */
function checkLabel(value: unknown, fieldErrors: Record<string, string>): string {
  if (value === undefined || value === null) return DEFAULT_LABEL;
  if (typeof value !== 'string') {
    fieldErrors.label = 'Label must be text.';
    return DEFAULT_LABEL;
  }
  const label = value.trim();
  if (label.length > 30) fieldErrors.label = 'Label must be at most 30 characters.';
  return label === '' ? DEFAULT_LABEL : label;
}

function checkDefaultFlag(value: unknown, fieldErrors: Record<string, string>): boolean | null {
  if (value === undefined) return null;
  if (typeof value !== 'boolean') {
    fieldErrors.isDefault = 'isDefault must be true or false.';
    return null;
  }
  return value;
}

/**
 * Validates a new address-book entry with the same rules as checkout (names, street, country, a region
 * of that country, a postal code that matches the country, phone). `isDefault` is optional.
 */
export function validateNewBookAddress(raw: unknown, countries: CountryInfo[]): BookResult {
  const body = objectOf(raw);
  const result = validateAddress(body, countries);
  const fieldErrors: Record<string, string> = result.ok ? {} : { ...result.fieldErrors };
  const label = checkLabel(body.label, fieldErrors);
  const makeDefault = checkDefaultFlag(body.isDefault, fieldErrors);
  if (!result.ok || Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  return { ok: true, address: { ...result.address, label }, makeDefault };
}

/**
 * Validates a partial update: the fields that are present overwrite the stored address, then the
 * merged address is checked as a whole (so changing the country needs a matching region and postal code).
 */
export function validateBookAddressPatch(raw: unknown, existing: BookAddressInput, countries: CountryInfo[]): BookResult {
  const body = objectOf(raw);
  const known = [...ADDRESS_FIELDS, 'label', 'isDefault'];
  if (!known.some((key) => key in body)) {
    return { ok: false, fieldErrors: { body: `Send at least one field to change: ${known.join(', ')}.` } };
  }
  const merged: Record<string, unknown> = { ...existing };
  for (const key of ADDRESS_FIELDS) if (key in body) merged[key] = body[key];
  if ('label' in body) merged.label = body.label;
  return validateNewBookAddress({ ...merged, isDefault: body.isDefault }, countries);
}
