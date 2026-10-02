import { afterEach, describe, expect, it } from 'vitest';
import { clientFlags, isOn, parseConfigFlags, setClientFlags } from './flags';

afterEach(() => setClientFlags([]));

describe('client flag state', () => {
  it('starts with every flag off', () => {
    expect(clientFlags()).toEqual([]);
    expect(isOn('f01')).toBe(false);
  });

  it('reports the IDs it was given', () => {
    setClientFlags(['f03', 'f01']);
    expect(isOn('f01')).toBe(true);
    expect(isOn('f02')).toBe(false);
    expect(clientFlags()).toEqual(['f01', 'f03']);
  });

  it('reads flag IDs from a config response and ignores anything else', () => {
    expect(parseConfigFlags({ flags: ['f01', 'f02'] })).toEqual(['f01', 'f02']);
    expect(parseConfigFlags({ flags: ['f01', 7, null] })).toEqual(['f01']);
    expect(parseConfigFlags({ flags: 'f01' })).toEqual([]);
    expect(parseConfigFlags(null)).toEqual([]);
    expect(parseConfigFlags('x')).toEqual([]);
  });
});
