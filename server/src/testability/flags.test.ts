import { afterEach, describe, expect, it } from 'vitest';
import { ApiError } from '../lib/errors';
import { FLAG_IDS, activeFlags, initFlagsFromEnv, isActive, isFlagId, nextFlags, parseFlagList, parseFlagRequest, setActiveFlags } from './flags';

afterEach(() => setActiveFlags([]));

describe('flag registry', () => {
  it('has unique, ordered IDs of the form fNN', () => {
    expect(new Set(FLAG_IDS).size).toBe(FLAG_IDS.length);
    expect(FLAG_IDS.every((id) => /^f\d{2}$/.test(id))).toBe(true);
    expect([...FLAG_IDS]).toEqual([...FLAG_IDS].sort());
    expect(FLAG_IDS.length).toBeGreaterThanOrEqual(18);
  });

  it('recognises known IDs only', () => {
    expect(isFlagId('f01')).toBe(true);
    expect(isFlagId('f00')).toBe(false);
    expect(isFlagId('F01')).toBe(false);
    expect(isFlagId(1)).toBe(false);
  });

  it('starts with every flag off', () => {
    expect(activeFlags()).toEqual([]);
    expect(FLAG_IDS.some((id) => isActive(id))).toBe(false);
  });
});

describe('FLAGS environment parsing', () => {
  it('reads a comma separated list, ignoring spaces, case and empty items', () => {
    expect(parseFlagList(' f03, F01 ,,f02 ')).toEqual({ flags: ['f01', 'f02', 'f03'], unknown: [] });
  });

  it('treats a missing or empty value as no flags', () => {
    expect(parseFlagList(undefined).flags).toEqual([]);
    expect(parseFlagList('').flags).toEqual([]);
  });

  it('collects unknown IDs', () => {
    expect(parseFlagList('f01,f99,nope')).toEqual({ flags: ['f01'], unknown: ['f99', 'nope'] });
  });

  it('accepts the words all and none', () => {
    expect(parseFlagList('all').flags).toEqual([...FLAG_IDS]);
    expect(parseFlagList('all,none,f02').flags).toEqual(['f02']);
  });

  it('applies the value at boot and refuses unknown IDs', () => {
    expect(initFlagsFromEnv('f02,f01')).toEqual(['f01', 'f02']);
    expect(activeFlags()).toEqual(['f01', 'f02']);
    expect(() => initFlagsFromEnv('f01,zzz')).toThrow(/unknown flag IDs: zzz/);
    expect(activeFlags()).toEqual(['f01', 'f02']);
  });
});

describe('flag requests', () => {
  it('accepts enable, disable and preset', () => {
    expect(parseFlagRequest({ enable: ['f01'] })).toEqual({ preset: undefined, enable: ['f01'], disable: [] });
    expect(parseFlagRequest({ disable: ['f02'] })).toEqual({ preset: undefined, enable: [], disable: ['f02'] });
    expect(parseFlagRequest({ preset: 'all' })).toEqual({ preset: 'all', enable: [], disable: [] });
  });

  it('rejects an empty body, a bad preset and malformed lists', () => {
    for (const body of [{}, { preset: 'some' }, { enable: 'f01' }, { enable: [1] }, { disable: {} }]) {
      expect(() => parseFlagRequest(body)).toThrow(ApiError);
    }
  });

  it('rejects unknown IDs with a field error that names them', () => {
    try {
      parseFlagRequest({ enable: ['f01', 'f77'], disable: ['x1'] });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(400);
      expect(apiErr.fieldErrors?.enable).toContain('f77');
      expect(apiErr.fieldErrors?.disable).toContain('x1');
    }
  });

  it('applies the preset first, then enable, then disable', () => {
    expect(nextFlags([], { enable: ['f02', 'f01'], disable: [] })).toEqual(['f01', 'f02']);
    expect(nextFlags(['f01', 'f02'], { enable: [], disable: ['f01'] })).toEqual(['f02']);
    expect(nextFlags(['f01'], { preset: 'none', enable: [], disable: [] })).toEqual([]);
    expect(nextFlags([], { preset: 'all', enable: [], disable: [] })).toEqual([...FLAG_IDS]);
    expect(nextFlags(['f05'], { preset: 'none', enable: ['f03'], disable: ['f03', 'f04'] })).toEqual([]);
    expect(nextFlags(['f05'], { preset: 'all', enable: [], disable: ['f05'] })).not.toContain('f05');
  });

  it('keeps the active list in registry order', () => {
    setActiveFlags(['f09', 'f02']);
    expect(activeFlags()).toEqual(['f02', 'f09']);
    expect(isActive('f09')).toBe(true);
    expect(isActive('f03')).toBe(false);
  });
});
