import { createHash, randomBytes } from 'node:crypto';
import type { AuthUser } from '../context';
import type { Db } from '../db/connection';

export const SESSION_TTL_SHORT_MS = 60 * 60 * 1000; // 1 hour
export const SESSION_TTL_LONG_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export interface CreatedSession {
  token: string;
  expiresAt: string;
  ttlMs: number;
}

export function createSession(db: Db, userId: number, rememberMe: boolean, now = Date.now()): CreatedSession {
  const token = randomBytes(32).toString('hex');
  const ttlMs = rememberMe ? SESSION_TTL_LONG_MS : SESSION_TTL_SHORT_MS;
  const expiresAt = new Date(now + ttlMs).toISOString();
  db.prepare('INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(
    hashToken(token),
    userId,
    new Date(now).toISOString(),
    expiresAt,
  );
  return { token, expiresAt, ttlMs };
}

/** Returns the user for a live session, or null when the token is unknown, expired or the user is locked. */
export function findSessionUser(db: Db, token: string, now = Date.now()): AuthUser | null {
  const row = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.role, u.locked, s.expires_at
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.id = ?`,
    )
    .get(hashToken(token)) as
    | { id: number; name: string; email: string; role: 'customer' | 'admin'; locked: number; expires_at: string }
    | undefined;
  if (!row) return null;
  if (Date.parse(row.expires_at) <= now) {
    deleteSession(db, token);
    return null;
  }
  if (row.locked) return null;
  return { id: row.id, name: row.name, email: row.email, role: row.role };
}

export function deleteSession(db: Db, token: string): void {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(hashToken(token));
}
