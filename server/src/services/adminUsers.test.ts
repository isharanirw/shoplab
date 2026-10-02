import { beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../config';
import { openDatabase } from '../db/connection';
import type { Db } from '../db/connection';
import { seedDatabase } from '../db/seed';
import { ApiError } from '../lib/errors';
import { getAdminUser, listAdminUsers, setUserLocked } from './adminUsers';
import { createSession, findSessionUser } from './sessions';

const seedDir = loadConfig().seedDir;
const ADMIN_ID = 4;
let db: Db;

function failure(fn: () => unknown): ApiError {
  try {
    fn();
  } catch (err) {
    if (err instanceof ApiError) return err;
    throw err;
  }
  throw new Error('Expected an ApiError');
}

const query = (raw: Record<string, unknown> = {}) => ({ q: '', page: 1, pageSize: 10, ...raw }) as Parameters<typeof listAdminUsers>[1];

beforeEach(() => {
  db = openDatabase(':memory:');
  seedDatabase(db, seedDir);
});

describe('admin user list', () => {
  it('lists the four seeded accounts in ID order without any password data', () => {
    const res = listAdminUsers(db, query());
    expect(res).toMatchObject({ page: 1, pageSize: 10, total: 4 });
    expect(res.data.map((u) => [u.id, u.email, u.role, u.locked])).toEqual([
      [1, 'customer1@shoplab.test', 'customer', false],
      [2, 'customer2@shoplab.test', 'customer', false],
      [3, 'locked@shoplab.test', 'customer', true],
      [4, 'admin@shoplab.test', 'admin', false],
    ]);
    expect(Object.keys(res.data[0]!).sort()).toEqual(['createdAt', 'email', 'id', 'locked', 'name', 'role']);
  });

  it('searches name and email ignoring case and pages past the end', () => {
    expect(listAdminUsers(db, query({ q: 'LOCKED' })).data.map((u) => u.id)).toEqual([3]);
    expect(listAdminUsers(db, query({ q: 'nobody' })).total).toBe(0);
    expect(listAdminUsers(db, query({ page: 3, pageSize: 2 }))).toEqual({ data: [], page: 3, pageSize: 2, total: 4 });
  });
});

describe('lock and unlock', () => {
  it('locks a customer and unlocks the seeded locked account', () => {
    expect(setUserLocked(db, ADMIN_ID, 2, true)).toMatchObject({ id: 2, locked: true });
    expect(setUserLocked(db, ADMIN_ID, 3, false)).toMatchObject({ id: 3, locked: false });
    expect(getAdminUser(db, 3)!.locked).toBe(false);
  });

  it('is idempotent: setting the state a user already has is a success', () => {
    expect(setUserLocked(db, ADMIN_ID, 3, true).locked).toBe(true);
    expect(setUserLocked(db, ADMIN_ID, 2, false).locked).toBe(false);
  });

  it('refuses a non-boolean (400), an unknown user (404) and locking yourself (409)', () => {
    for (const bad of ['true', 1, null, undefined]) {
      const err = failure(() => setUserLocked(db, ADMIN_ID, 2, bad));
      expect(err.status).toBe(400);
      expect(err.fieldErrors?.locked).toBeDefined();
    }
    expect(failure(() => setUserLocked(db, ADMIN_ID, 999, true)).status).toBe(404);
    expect(failure(() => setUserLocked(db, ADMIN_ID, ADMIN_ID, true)).status).toBe(409);
    expect(getAdminUser(db, ADMIN_ID)!.locked).toBe(false);
  });

  it('ends the locked user\'s sessions, and unlocking does not bring them back', () => {
    const { token } = createSession(db, 2, false);
    expect(findSessionUser(db, token)?.id).toBe(2);
    setUserLocked(db, ADMIN_ID, 2, true);
    expect(findSessionUser(db, token)).toBeNull();
    expect(db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE user_id = 2').get()).toEqual({ n: 0 });
    setUserLocked(db, ADMIN_ID, 2, false);
    expect(findSessionUser(db, token)).toBeNull();
  });

  it('leaves other users\' sessions alone', () => {
    const { token } = createSession(db, 1, false);
    setUserLocked(db, ADMIN_ID, 2, true);
    expect(findSessionUser(db, token)?.id).toBe(1);
  });

  it('is undone by a reseed (the locked account is locked again, everyone else is not)', () => {
    setUserLocked(db, ADMIN_ID, 3, false);
    setUserLocked(db, ADMIN_ID, 2, true);
    seedDatabase(db, seedDir);
    expect(listAdminUsers(db, query()).data.map((u) => u.locked)).toEqual([false, false, true, false]);
  });
});
