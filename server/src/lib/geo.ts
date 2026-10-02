import { ApiError } from './errors';

/** The shipping country reported when nothing overrides it. Fixed so tests can rely on it. */
export const DEFAULT_GEO_COUNTRY = 'SE';

export interface GeoCountry {
  countryCode: string;
  countryName: string;
}

/**
 * The "detected" shipping country. There is no lookup: the answer is Sweden unless the caller passes
 * `?country=<code>` (matched ignoring case) with one of the supported codes. An unknown code is a 400.
 */
export function resolveGeoCountry(override: unknown, countries: { code: string; name: string }[]): GeoCountry {
  let code = DEFAULT_GEO_COUNTRY;
  if (override !== undefined && override !== '') {
    if (typeof override !== 'string') {
      throw new ApiError('VALIDATION_ERROR', 'The country must be a single country code.', { fieldErrors: { country: 'Provide this parameter only once.' } });
    }
    const match = countries.find((c) => c.code.toLowerCase() === override.trim().toLowerCase());
    if (!match) {
      const known = countries.map((c) => c.code).join(', ');
      throw new ApiError('VALIDATION_ERROR', `Unknown country code. Use one of: ${known}.`, {
        fieldErrors: { country: `Must be one of: ${known}.` },
      });
    }
    code = match.code;
  }
  const country = countries.find((c) => c.code === code);
  return { countryCode: code, countryName: country?.name ?? code };
}
