import { describe, expect, it } from 'vitest';
import { ApiError } from './errors';
import { DEFAULT_GEO_COUNTRY, resolveGeoCountry } from './geo';

const countries = [
  { code: 'IN', name: 'India' },
  { code: 'SE', name: 'Sweden' },
  { code: 'US', name: 'United States' },
];

describe('resolveGeoCountry', () => {
  it('always answers Sweden without an override', () => {
    expect(DEFAULT_GEO_COUNTRY).toBe('SE');
    expect(resolveGeoCountry(undefined, countries)).toEqual({ countryCode: 'SE', countryName: 'Sweden' });
    expect(resolveGeoCountry('', countries)).toEqual({ countryCode: 'SE', countryName: 'Sweden' });
  });

  it('accepts a supported code in any case', () => {
    expect(resolveGeoCountry('us', countries)).toEqual({ countryCode: 'US', countryName: 'United States' });
    expect(resolveGeoCountry(' IN ', countries).countryName).toBe('India');
  });

  it('rejects an unknown code or a repeated parameter with a 400', () => {
    for (const bad of ['FR', ['US', 'IN']]) {
      try {
        resolveGeoCountry(bad, countries);
        throw new Error('expected an error');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(400);
        expect((err as ApiError).fieldErrors?.country).toBeDefined();
      }
    }
  });
});
