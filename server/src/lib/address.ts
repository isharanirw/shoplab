export interface CountryInfo {
  code: string;
  name: string;
  postalPattern: string;
  postalHint: string;
  regions: { code: string; name: string }[];
}

export interface AddressInput {
  firstName: string;
  lastName: string;
  street: string;
  city: string;
  countryCode: string;
  regionCode: string;
  postalCode: string;
  phone: string;
}

/** Returns an error message when the postal code does not match the country's rule, otherwise null. */
export function validatePostalCode(country: CountryInfo, value: string): string | null {
  const code = value.trim();
  if (code === '') return 'Postal code is required.';
  if (!new RegExp(country.postalPattern).test(code)) {
    return `Postal code for ${country.name} must be ${country.postalHint}.`;
  }
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

function validateText(value: unknown, label: string, min: number, max: number): string | null {
  if (typeof value !== 'string' || value.trim() === '') return `${label} is required.`;
  const text = value.trim();
  if (text.length < min) return `${label} must be at least ${min} characters.`;
  if (text.length > max) return `${label} must be at most ${max} characters.`;
  return null;
}

export type AddressResult =
  | { ok: true; address: AddressInput }
  | { ok: false; fieldErrors: Record<string, string> };

/**
 * Validates a new shipping address from a request body. The region must belong to the chosen country
 * and the postal code must match that country's rule. City is optional.
 */
export function validateAddress(raw: unknown, countries: CountryInfo[]): AddressResult {
  const body = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const fieldErrors: Record<string, string> = {};

  const firstNameErr = validateText(body.firstName, 'First name', 1, 60);
  if (firstNameErr) fieldErrors.firstName = firstNameErr;
  const lastNameErr = validateText(body.lastName, 'Last name', 1, 60);
  if (lastNameErr) fieldErrors.lastName = lastNameErr;
  const streetErr = validateText(body.street, 'Street', 3, 100);
  if (streetErr) fieldErrors.street = streetErr;
  if (body.city !== undefined && body.city !== null && (typeof body.city !== 'string' || body.city.trim().length > 60)) {
    fieldErrors.city = 'City must be at most 60 characters.';
  }

  const country = typeof body.countryCode === 'string' ? countries.find((c) => c.code === body.countryCode) : undefined;
  if (!country) {
    fieldErrors.countryCode = 'Choose a country.';
  } else {
    const region = typeof body.regionCode === 'string' ? country.regions.find((r) => r.code === body.regionCode) : undefined;
    if (!region) fieldErrors.regionCode = `Choose a region in ${country.name}.`;
    const postalErr = typeof body.postalCode === 'string' ? validatePostalCode(country, body.postalCode) : 'Postal code is required.';
    if (postalErr) fieldErrors.postalCode = postalErr;
  }

  const phoneErr = typeof body.phone === 'string' ? validatePhone(body.phone) : 'Phone number is required.';
  if (phoneErr) fieldErrors.phone = phoneErr;

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  return {
    ok: true,
    address: {
      firstName: (body.firstName as string).trim(),
      lastName: (body.lastName as string).trim(),
      street: (body.street as string).trim(),
      city: typeof body.city === 'string' ? body.city.trim() : '',
      countryCode: body.countryCode as string,
      regionCode: body.regionCode as string,
      postalCode: (body.postalCode as string).trim(),
      phone: (body.phone as string).trim(),
    },
  };
}
