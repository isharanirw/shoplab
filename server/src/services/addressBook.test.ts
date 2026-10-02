import { beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../config';
import { openDatabase } from '../db/connection';
import type { Db } from '../db/connection';
import { seedDatabase } from '../db/seed';
import { ApiError } from '../lib/errors';
import { createAddress, deleteAddress, updateAddress } from './addressBook';
import { listAddresses } from './locations';

let db: Db;

beforeEach(() => {
  db = openDatabase(':memory:');
  seedDatabase(db, loadConfig().seedDir);
});

function failure(fn: () => unknown): ApiError {
  try {
    fn();
  } catch (err) {
    if (err instanceof ApiError) return err;
    throw err;
  }
  throw new Error('Expected an ApiError');
}

const swedish = {
  label: 'Cabin',
  firstName: 'Sam',
  lastName: 'Tester',
  street: 'Storgatan 1',
  city: 'Umea',
  countryCode: 'SE',
  regionCode: 'AB',
  postalCode: '90325',
  phone: '+46 90 123 456',
};

const defaultsOf = (userId: number) => listAddresses(db, userId).data.filter((a) => a.isDefault).map((a) => a.id);

describe('createAddress', () => {
  it('makes the first address of a user the default, even without isDefault', () => {
    const created = createAddress(db, 2, swedish);
    expect(created).toMatchObject({ label: 'Cabin', isDefault: true, countryName: 'Sweden' });
    expect(defaultsOf(2)).toEqual([created.id]);
  });

  it('keeps the existing default unless isDefault is true', () => {
    const second = createAddress(db, 1, swedish);
    expect(second.isDefault).toBe(false);
    expect(defaultsOf(1)).toEqual([1]);
    const third = createAddress(db, 1, { ...swedish, street: 'Kungsgatan 5', isDefault: true });
    expect(third.isDefault).toBe(true);
    expect(defaultsOf(1)).toEqual([third.id]);
  });

  it('uses the same per-country postal code rules as checkout', () => {
    expect(failure(() => createAddress(db, 2, { ...swedish, postalCode: '1234' })).fieldErrors).toHaveProperty('postalCode');
    expect(failure(() => createAddress(db, 2, { ...swedish, countryCode: 'IN', regionCode: 'MH', postalCode: '40001' })).fieldErrors).toHaveProperty(
      'postalCode',
    );
    expect(createAddress(db, 2, { ...swedish, countryCode: 'IN', regionCode: 'MH', postalCode: '400001' }).countryCode).toBe('IN');
  });

  it('rejects a region that belongs to another country and reports every field problem', () => {
    const err = failure(() => createAddress(db, 2, { ...swedish, regionCode: 'WA', firstName: '', phone: 'abc', isDefault: 'yes', label: 'x'.repeat(31) }));
    expect(err.status).toBe(400);
    expect(Object.keys(err.fieldErrors ?? {}).sort()).toEqual(['firstName', 'isDefault', 'label', 'phone', 'regionCode']);
  });

  it('labels a blank label "Address" and limits a user to 10 addresses', () => {
    expect(createAddress(db, 2, { ...swedish, label: '  ' }).label).toBe('Address');
    for (let i = 1; i < 10; i++) createAddress(db, 2, swedish);
    expect(failure(() => createAddress(db, 2, swedish)).status).toBe(409);
  });
});

describe('updateAddress', () => {
  it('changes only the fields sent and keeps the rest', () => {
    const updated = updateAddress(db, 1, 2, { street: '501 Pine Street', label: 'Office' });
    expect(updated).toMatchObject({ id: 2, street: '501 Pine Street', label: 'Office', postalCode: '98101', isDefault: false });
  });

  it('validates the merged address: a new country needs a matching region and postal code', () => {
    const err = failure(() => updateAddress(db, 1, 2, { countryCode: 'SE' }));
    expect(err.fieldErrors).toHaveProperty('regionCode');
    const ok = updateAddress(db, 1, 2, { countryCode: 'SE', regionCode: 'AB', postalCode: '11157' });
    expect(ok).toMatchObject({ countryCode: 'SE', regionCode: 'AB' });
  });

  it('moves the default when isDefault is true, leaving exactly one default', () => {
    updateAddress(db, 1, 2, { isDefault: true });
    expect(defaultsOf(1)).toEqual([2]);
  });

  it('refuses to unset the only default and an empty update', () => {
    expect(failure(() => updateAddress(db, 1, 1, { isDefault: false })).fieldErrors).toHaveProperty('isDefault');
    expect(failure(() => updateAddress(db, 1, 1, {})).fieldErrors).toHaveProperty('body');
    expect(defaultsOf(1)).toEqual([1]);
  });

  it('treats another user\'s address as not found', () => {
    expect(failure(() => updateAddress(db, 2, 1, { street: 'Hacked 1' })).status).toBe(404);
    expect(failure(() => updateAddress(db, 1, 999, { street: 'Nowhere 1' })).status).toBe(404);
  });
});

describe('deleteAddress', () => {
  it('deletes a non-default address and keeps the default', () => {
    deleteAddress(db, 1, 2);
    expect(listAddresses(db, 1).data.map((a) => a.id)).toEqual([1]);
    expect(defaultsOf(1)).toEqual([1]);
  });

  it('passes the default to the earliest remaining address when the default is deleted', () => {
    const third = createAddress(db, 1, swedish);
    deleteAddress(db, 1, 1);
    expect(defaultsOf(1)).toEqual([2]);
    deleteAddress(db, 1, 2);
    expect(defaultsOf(1)).toEqual([third.id]);
  });

  it('leaves no addresses and no default after the last one is deleted, and the next one becomes the default', () => {
    deleteAddress(db, 1, 1);
    deleteAddress(db, 1, 2);
    expect(listAddresses(db, 1).total).toBe(0);
    expect(createAddress(db, 1, swedish).isDefault).toBe(true);
  });

  it('treats another user\'s address as not found and leaves it alone', () => {
    expect(failure(() => deleteAddress(db, 2, 1)).status).toBe(404);
    expect(listAddresses(db, 1).total).toBe(2);
  });
});
