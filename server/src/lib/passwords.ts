import bcrypt from 'bcryptjs';
import { f03 } from '../testability/variants';

export const PASSWORD_MIN_LENGTH = 8;
const BCRYPT_COST = 10;

/**
 * Password rules: at least 8 characters, one uppercase letter, one digit and
 * one symbol (any character that is not a letter or digit).
 * Returns a message for the first rule that fails, or null when valid.
 */
export function validatePassword(password: string): string | null {
  if (password.length < f03(PASSWORD_MIN_LENGTH)) return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (!/\p{Lu}/u.test(password)) return 'Password must contain at least one uppercase letter.';
  if (!/\d/.test(password)) return 'Password must contain at least one digit.';
  if (!/[^\p{L}\d]/u.test(password)) return 'Password must contain at least one symbol.';
  return null;
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, BCRYPT_COST);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}
