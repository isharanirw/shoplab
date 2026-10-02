export const CONSENT_STORAGE_KEY = 'shoplab.cookieConsent';

export interface ConsentChoice {
  analytics: boolean;
  marketing: boolean;
}

export const ACCEPT_ALL: ConsentChoice = { analytics: true, marketing: true };
export const REJECT_ALL: ConsentChoice = { analytics: false, marketing: false };

type ReadableStorage = Pick<Storage, 'getItem'>;
type WritableStorage = Pick<Storage, 'setItem'>;

export function serialiseConsent(choice: ConsentChoice): string {
  return JSON.stringify({ v: 1, analytics: choice.analytics, marketing: choice.marketing });
}

/** Reads a stored choice; anything missing or malformed means no choice was made yet. */
export function parseConsent(raw: string | null): ConsentChoice | null {
  if (raw === null) return null;
  try {
    const value = JSON.parse(raw) as { v?: unknown; analytics?: unknown; marketing?: unknown } | null;
    if (!value || value.v !== 1 || typeof value.analytics !== 'boolean' || typeof value.marketing !== 'boolean') return null;
    return { analytics: value.analytics, marketing: value.marketing };
  } catch {
    return null;
  }
}

/** The saved choice, or null on a first visit (and when storage is unavailable). */
export function readConsent(storage: ReadableStorage | null): ConsentChoice | null {
  if (!storage) return null;
  try {
    return parseConsent(storage.getItem(CONSENT_STORAGE_KEY));
  } catch {
    return null;
  }
}

/** Saves a choice; returns false when storage refused it (the banner then shows again next time). */
export function saveConsent(storage: WritableStorage | null, choice: ConsentChoice): boolean {
  if (!storage) return false;
  try {
    storage.setItem(CONSENT_STORAGE_KEY, serialiseConsent(choice));
    return true;
  } catch {
    return false;
  }
}

/** The browser's localStorage, or null when it cannot be used. */
export function browserStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
