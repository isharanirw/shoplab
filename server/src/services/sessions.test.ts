import { beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../config';
import { openDatabase } from '../db/connection';
import type { Db } from '../db/connection';
import { seedDatabase } from '../db/seed';
import { createSession, deleteSession, findSessionUser, SESSION_TTL_LONG_MS, SESSION_TTL_SHORT_MS } from './sessions';

let db: Db;
beforeEach(() => {
  db = openDatabase(':memory:');
  seedDatabase(db, loadConfig().seedDir);
});

describe('sessions', () => {
  it('uses 1 hour by default and 7 days with remember me', () => {
    expect(createSession(db, 1, false).ttlMs).toBe(SESSION_TTL_SHORT_MS);
    expect(createSession(db, 1, true).ttlMs).toBe(SESSION_TTL_LONG_MS);
    expect(SESSION_TTL_SHORT_MS).toBe(3_600_000);
    expect(SESSION_TTL_LONG_MS).toBe(604_800_000);
  });

  it('resolves a live session to its user without exposing the hash', () => {
    const { token } = createSession(db, 1, false);
    expect(findSessionUser(db, token)).toEqual({
      id: 1,
      name: 'Casey Customer',
      email: 'customer1@shoplab.test',
      role: 'customer',
    });
  });

  it('rejects unknown tokens', () => {
    expect(findSessionUser(db, 'nope')).toBeNull();
  });

  it('expires a short session after one hour and a long one after seven days', () => {
    const t0 = Date.now();
    const short = createSession(db, 1, false, t0);
    const long = createSession(db, 1, true, t0);
    expect(findSessionUser(db, short.token, t0 + SESSION_TTL_SHORT_MS - 1)).not.toBeNull();
    expect(findSessionUser(db, short.token, t0 + SESSION_TTL_SHORT_MS)).toBeNull();
    expect(findSessionUser(db, long.token, t0 + SESSION_TTL_SHORT_MS + 1)).not.toBeNull();
    expect(findSessionUser(db, long.token, t0 + SESSION_TTL_LONG_MS)).toBeNull();
  });

  it('stops honouring a session once the user is locked', () => {
    const { token } = createSession(db, 2, false);
    db.prepare('UPDATE users SET locked = 1 WHERE id = 2').run();
    expect(findSessionUser(db, token)).toBeNull();
  });

  it('removes a session on logout', () => {
    const { token } = createSession(db, 1, false);
    deleteSession(db, token);
    expect(findSessionUser(db, token)).toBeNull();
  });

  it('does not store the raw token', () => {
    const { token } = createSession(db, 1, false);
    const ids = db.prepare('SELECT id FROM sessions').all() as { id: string }[];
    expect(ids.map((r) => r.id)).not.toContain(token);
  });
});
