import { beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../config';
import { openDatabase } from '../db/connection';
import type { Db } from '../db/connection';
import { seedDatabase } from '../db/seed';
import { ApiError } from '../lib/errors';
import { saveContactMessage } from './contact';

let db: Db;

beforeEach(() => {
  db = openDatabase(':memory:');
  seedDatabase(db, loadConfig().seedDir);
});

const valid = { topic: 'returns', message: 'How do I return a parcel?', consent: true };

describe('saveContactMessage', () => {
  it('stores the message with the user, or without one for a visitor', () => {
    const a = saveContactMessage(db, 1, valid, new Date('2026-10-02T10:00:00.000Z'));
    const b = saveContactMessage(db, null, { ...valid, topic: 'other' });
    expect(b).toBe(a + 1);
    expect(db.prepare('SELECT user_id, topic, message, created_at FROM contact_messages ORDER BY id').all()).toEqual([
      { user_id: 1, topic: 'returns', message: 'How do I return a parcel?', created_at: '2026-10-02T10:00:00.000Z' },
      { user_id: null, topic: 'other', message: 'How do I return a parcel?', created_at: expect.any(String) },
    ]);
  });

  it('stores nothing and answers 400 with field errors when invalid', () => {
    let error: unknown;
    try {
      saveContactMessage(db, 1, { topic: '', message: 'short', consent: false });
    } catch (err) {
      error = err;
    }
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(400);
    expect(Object.keys((error as ApiError).fieldErrors ?? {}).sort()).toEqual(['consent', 'message', 'topic']);
    expect(db.prepare('SELECT COUNT(*) AS n FROM contact_messages').get()).toEqual({ n: 0 });
  });

  it('is emptied by a reset', () => {
    saveContactMessage(db, 1, valid);
    seedDatabase(db, loadConfig().seedDir);
    expect(db.prepare('SELECT COUNT(*) AS n FROM contact_messages').get()).toEqual({ n: 0 });
  });
});
