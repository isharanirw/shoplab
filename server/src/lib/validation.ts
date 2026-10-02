import { validatePassword } from './passwords';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateEmail(email: string): string | null {
  const e = email.trim();
  if (e.length === 0) return 'Email is required.';
  if (e.length > 254 || !EMAIL_RE.test(e)) return 'Enter a valid email address.';
  return null;
}

export function validateName(name: string): string | null {
  const n = name.trim();
  if (n.length === 0) return 'Name is required.';
  if (n.length < 2) return 'Name must be at least 2 characters.';
  if (n.length > 60) return 'Name must be at most 60 characters.';
  return null;
}

/** Returns a map of field name to message; empty when the input is valid. */
export function validateRegistration(body: Record<string, unknown>): Record<string, string> {
  const errors: Record<string, string> = {};

  const nameErr = typeof body.name === 'string' ? validateName(body.name) : 'Name is required.';
  if (nameErr) errors.name = nameErr;

  const emailErr = typeof body.email === 'string' ? validateEmail(body.email) : 'Email is required.';
  if (emailErr) errors.email = emailErr;

  const password = typeof body.password === 'string' ? body.password : '';
  const pwErr = typeof body.password === 'string' ? validatePassword(password) : 'Password is required.';
  if (pwErr) errors.password = pwErr;

  if (typeof body.confirmPassword !== 'string' || body.confirmPassword.length === 0) {
    errors.confirmPassword = 'Please confirm your password.';
  } else if (!pwErr && body.confirmPassword !== password) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  if (body.acceptTerms !== true) errors.acceptTerms = 'You must accept the terms to register.';
  return errors;
}
