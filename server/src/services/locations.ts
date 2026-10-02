import type { Db } from '../db/connection';
import type { CountryInfo } from '../lib/address';

export interface ListResult<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

export function listCountries(db: Db): CountryInfo[] {
  const countries = db
    .prepare('SELECT code, name, postal_pattern AS postalPattern, postal_hint AS postalHint FROM countries ORDER BY name')
    .all() as Omit<CountryInfo, 'regions'>[];
  const regions = db.prepare('SELECT country_code AS countryCode, code, name FROM regions ORDER BY id').all() as {
    countryCode: string;
    code: string;
    name: string;
  }[];
  return countries.map((c) => ({
    ...c,
    regions: regions.filter((r) => r.countryCode === c.code).map((r) => ({ code: r.code, name: r.name })),
  }));
}

export interface SavedAddress {
  id: number;
  label: string;
  firstName: string;
  lastName: string;
  street: string;
  city: string;
  regionCode: string;
  regionName: string;
  countryCode: string;
  countryName: string;
  postalCode: string;
  phone: string;
  isDefault: boolean;
}

interface AddressRow {
  id: number;
  label: string;
  first_name: string;
  last_name: string;
  street: string;
  city: string;
  region_code: string;
  region_name: string | null;
  country_code: string;
  country_name: string;
  postal_code: string;
  phone: string;
  is_default: number;
}

const ADDRESS_SELECT = `
  SELECT a.id, a.label, a.first_name, a.last_name, a.street, a.city, a.region_code, r.name AS region_name,
         a.country_code, c.name AS country_name, a.postal_code, a.phone, a.is_default
  FROM addresses a
  JOIN countries c ON c.code = a.country_code
  LEFT JOIN regions r ON r.country_code = a.country_code AND r.code = a.region_code`;

function mapAddress(row: AddressRow): SavedAddress {
  return {
    id: row.id,
    label: row.label,
    firstName: row.first_name,
    lastName: row.last_name,
    street: row.street,
    city: row.city,
    regionCode: row.region_code,
    regionName: row.region_name ?? row.region_code,
    countryCode: row.country_code,
    countryName: row.country_name,
    postalCode: row.postal_code,
    phone: row.phone,
    isDefault: row.is_default === 1,
  };
}

/** The user's saved addresses, default first. Read only for now; the address book comes in a later phase. */
export function listAddresses(db: Db, userId: number): ListResult<SavedAddress> {
  const rows = db.prepare(`${ADDRESS_SELECT} WHERE a.user_id = ? ORDER BY a.is_default DESC, a.id`).all(userId) as AddressRow[];
  const data = rows.map(mapAddress);
  return { data, page: 1, pageSize: data.length, total: data.length };
}

export function findAddress(db: Db, userId: number, addressId: number): SavedAddress | null {
  const row = db.prepare(`${ADDRESS_SELECT} WHERE a.user_id = ? AND a.id = ?`).get(userId, addressId) as AddressRow | undefined;
  return row ? mapAddress(row) : null;
}
