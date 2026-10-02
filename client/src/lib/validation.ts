// Mirrors the server rules in server/src/lib so inline messages match what the API returns.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateName(name: string): string | null {
  const n = name.trim();
  if (n.length === 0) return 'Name is required.';
  if (n.length < 2) return 'Name must be at least 2 characters.';
  if (n.length > 60) return 'Name must be at most 60 characters.';
  return null;
}

export function validateEmail(email: string): string | null {
  const e = email.trim();
  if (e.length === 0) return 'Email is required.';
  if (e.length > 254 || !EMAIL_RE.test(e)) return 'Enter a valid email address.';
  return null;
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (!/\p{Lu}/u.test(password)) return 'Password must contain at least one uppercase letter.';
  if (!/\d/.test(password)) return 'Password must contain at least one digit.';
  if (!/[^\p{L}\d]/u.test(password)) return 'Password must contain at least one symbol.';
  return null;
}

export function validateConfirmPassword(password: string, confirm: string): string | null {
  if (confirm.length === 0) return 'Please confirm your password.';
  if (confirm !== password) return 'Passwords do not match.';
  return null;
}

export function validateTerms(accepted: boolean): string | null {
  return accepted ? null : 'You must accept the terms to register.';
}
