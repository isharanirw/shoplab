import type { Db } from '../db/connection';
import { MAX_ADDRESSES, validateBookAddressPatch, validateNewBookAddress } from '../lib/addressBook';
import type { BookAddressInput } from '../lib/addressBook';
import { ApiError } from '../lib/errors';
import { findAddress, listCountries } from './locations';
import type { SavedAddress } from './locations';

function validationError(fieldErrors: Record<string, string>): ApiError {
  return new ApiError('VALIDATION_ERROR', 'Please correct the highlighted fields.', { fieldErrors });
}

function fieldsOf(a: SavedAddress): BookAddressInput {
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
  };
}

function setDefault(db: Db, userId: number, addressId: number): void {
  db.prepare('UPDATE addresses SET is_default = CASE WHEN id = ? THEN 1 ELSE 0 END WHERE user_id = ?').run(addressId, userId);
}

/**
 * Adds an address. The first address of a user always becomes the default; otherwise the new address is
 * the default only when `isDefault: true` is sent (the previous default is then cleared). 409 after 10 addresses.
 */
export function createAddress(db: Db, userId: number, raw: unknown): SavedAddress {
  const checked = validateNewBookAddress(raw, listCountries(db));
  if (!checked.ok) throw validationError(checked.fieldErrors);
  const a = checked.address;
  const run = db.transaction((): number => {
    const { n } = db.prepare('SELECT COUNT(*) AS n FROM addresses WHERE user_id = ?').get(userId) as { n: number };
    if (n >= MAX_ADDRESSES) {
      throw new ApiError('CONFLICT', `You can save up to ${MAX_ADDRESSES} addresses. Delete one to add another.`);
    }
    const info = db
      .prepare(
        `INSERT INTO addresses (user_id, label, first_name, last_name, street, city, region_code, country_code, postal_code, phone, is_default)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      )
      .run(userId, a.label, a.firstName, a.lastName, a.street, a.city, a.regionCode, a.countryCode, a.postalCode, a.phone);
    const id = Number(info.lastInsertRowid);
    if (n === 0 || checked.makeDefault === true) setDefault(db, userId, id);
    return id;
  });
  const id = run();
  return findAddress(db, userId, id)!;
}

/**
 * Updates an address (404 when it does not belong to the user). `isDefault: true` makes it the default.
 * `isDefault: false` on the current default is rejected with 400: make another address the default instead.
 */
export function updateAddress(db: Db, userId: number, addressId: number, raw: unknown): SavedAddress {
  const run = db.transaction((): void => {
    const existing = findAddress(db, userId, addressId);
    if (!existing) throw new ApiError('NOT_FOUND', 'Address not found.');
    const checked = validateBookAddressPatch(raw, fieldsOf(existing), listCountries(db));
    if (!checked.ok) throw validationError(checked.fieldErrors);
    if (checked.makeDefault === false && existing.isDefault) {
      throw validationError({ isDefault: 'There must always be a default address. Make another address the default instead.' });
    }
    const a = checked.address;
    db.prepare(
      `UPDATE addresses SET label = ?, first_name = ?, last_name = ?, street = ?, city = ?, region_code = ?,
         country_code = ?, postal_code = ?, phone = ? WHERE id = ? AND user_id = ?`,
    ).run(a.label, a.firstName, a.lastName, a.street, a.city, a.regionCode, a.countryCode, a.postalCode, a.phone, addressId, userId);
    if (checked.makeDefault === true) setDefault(db, userId, addressId);
  });
  run();
  return findAddress(db, userId, addressId)!;
}

/**
 * Deletes an address (404 when it does not belong to the user). When the default is deleted and other
 * addresses remain, the one added earliest (lowest ID) becomes the default, so a user with addresses always has exactly one.
 */
export function deleteAddress(db: Db, userId: number, addressId: number): void {
  const run = db.transaction((): void => {
    const existing = findAddress(db, userId, addressId);
    if (!existing) throw new ApiError('NOT_FOUND', 'Address not found.');
    db.prepare('DELETE FROM addresses WHERE id = ? AND user_id = ?').run(addressId, userId);
    if (existing.isDefault) {
      const next = db.prepare('SELECT id FROM addresses WHERE user_id = ? ORDER BY id LIMIT 1').get(userId) as { id: number } | undefined;
      if (next) setDefault(db, userId, next.id);
    }
  });
  run();
}
