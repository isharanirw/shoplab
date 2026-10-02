export const DEFAULT_AFTER_LOGIN = '/account';

/** Accepts only same-site relative paths so ?next= cannot send people to another site. */
export function safeNext(raw: string | null | undefined): string {
  if (!raw) return DEFAULT_AFTER_LOGIN;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return DEFAULT_AFTER_LOGIN;
  if (raw === '/login' || raw.startsWith('/login?') || raw === '/register') return DEFAULT_AFTER_LOGIN;
  return raw;
}

export function loginPathFor(path: string): string {
  return `/login?next=${encodeURIComponent(path)}`;
}
