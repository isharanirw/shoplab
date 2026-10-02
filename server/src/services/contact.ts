import type { Db } from '../db/connection';
import { ApiError } from '../lib/errors';
import { validateContact } from '../lib/contact';

/** Validates and stores a contact message (nothing is sent anywhere). Returns the new message ID. */
export function saveContactMessage(db: Db, userId: number | null, raw: unknown, now: Date = new Date()): number {
  const result = validateContact(raw);
  if (!result.ok) throw new ApiError('VALIDATION_ERROR', 'Please correct the highlighted fields.', { fieldErrors: result.fieldErrors });
  const info = db
    .prepare('INSERT INTO contact_messages (user_id, topic, message, created_at) VALUES (?, ?, ?, ?)')
    .run(userId, result.input.topic, result.input.message, now.toISOString());
  return Number(info.lastInsertRowid);
}
