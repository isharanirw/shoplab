import type { Db } from '../db/connection';
import type { AdminUserQuery } from '../lib/adminQuery';
import { ApiError } from '../lib/errors';
import type { ListResult } from './catalogue';

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: 'customer' | 'admin';
  locked: boolean;
  createdAt: string;
}

interface Row {
  id: number;
  name: string;
  email: string;
  role: 'customer' | 'admin';
  locked: number;
  created_at: string;
}

const toUser = (row: Row): AdminUser => ({
  id: row.id,
  name: row.name,
  email: row.email,
  role: row.role,
  locked: row.locked === 1,
  createdAt: row.created_at,
});

const SELECT = 'SELECT id, name, email, role, locked, created_at FROM users';

export function getAdminUser(db: Db, id: number): AdminUser | null {
  const row = db.prepare(`${SELECT} WHERE id = ?`).get(id) as Row | undefined;
  return row ? toUser(row) : null;
}

/** Users in ID order, optionally filtered by name or email text. A page past the end is an empty list. */
export function listAdminUsers(db: Db, query: AdminUserQuery): ListResult<AdminUser> {
  const where = query.q === '' ? '' : 'WHERE instr(lower(name), lower(?)) > 0 OR instr(lower(email), lower(?)) > 0';
  const params = query.q === '' ? [] : [query.q, query.q];
  const { n } = db.prepare(`SELECT COUNT(*) AS n FROM users ${where}`).get(...params) as { n: number };
  const rows = db
    .prepare(`${SELECT} ${where} ORDER BY id ASC LIMIT ? OFFSET ?`)
    .all(...params, query.pageSize, (query.page - 1) * query.pageSize) as Row[];
  return { data: rows.map(toUser), page: query.page, pageSize: query.pageSize, total: n };
}

/**
 * Locks or unlocks an account (400 when `locked` is not a boolean, 404 for an unknown user). An admin cannot lock
 * their own account (409). Setting the state a user already has changes nothing and is still a 200.
 * Locking also deletes the user's sessions, so unlocking later does not bring an old login back: the user logs in again.
 */
export function setUserLocked(db: Db, actingAdminId: number, userId: number, locked: unknown): AdminUser {
  if (typeof locked !== 'boolean') {
    throw new ApiError('VALIDATION_ERROR', 'Send {"locked": true} or {"locked": false}.', {
      fieldErrors: { locked: 'Must be true or false.' },
    });
  }
  const user = getAdminUser(db, userId);
  if (!user) throw new ApiError('NOT_FOUND', 'User not found.');
  if (locked && userId === actingAdminId) {
    throw new ApiError('CONFLICT', 'You cannot lock your own account.', { fieldErrors: { locked: 'You cannot lock your own account.' } });
  }
  db.transaction(() => {
    db.prepare('UPDATE users SET locked = ? WHERE id = ?').run(locked ? 1 : 0, userId);
    if (locked) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
  })();
  return getAdminUser(db, userId)!;
}
