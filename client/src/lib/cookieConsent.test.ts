import { describe, expect, it } from 'vitest';
import { ACCEPT_ALL, CONSENT_STORAGE_KEY, REJECT_ALL, parseConsent, readConsent, saveConsent, serialiseConsent } from './cookieConsent';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

describe('cookie consent storage', () => {
  it('is empty on a first visit', () => {
    expect(readConsent(memoryStorage())).toBeNull();
    expect(readConsent(null)).toBeNull();
  });

  it('round-trips accept all, reject all and a custom choice', () => {
    for (const choice of [ACCEPT_ALL, REJECT_ALL, { analytics: true, marketing: false }]) {
      const storage = memoryStorage();
      expect(saveConsent(storage, choice)).toBe(true);
      expect(readConsent(storage)).toEqual(choice);
    }
  });

  it('stores the choice under one key', () => {
    const storage = memoryStorage();
    saveConsent(storage, REJECT_ALL);
    expect(storage.getItem(CONSENT_STORAGE_KEY)).toBe(serialiseConsent(REJECT_ALL));
  });

  it('treats malformed or unknown-version values as no choice', () => {
    expect(parseConsent('not json')).toBeNull();
    expect(parseConsent('{"v":2,"analytics":true,"marketing":true}')).toBeNull();
    expect(parseConsent('{"v":1,"analytics":"yes","marketing":true}')).toBeNull();
    expect(parseConsent('null')).toBeNull();
  });

  it('survives storage that throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readConsent(broken)).toBeNull();
    expect(saveConsent(broken, ACCEPT_ALL)).toBe(false);
    expect(saveConsent(null, ACCEPT_ALL)).toBe(false);
  });
});
