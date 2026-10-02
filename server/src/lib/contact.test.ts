import { describe, expect, it } from 'vitest';
import { validateContact } from './contact';

const valid = { topic: 'order', message: 'Where is my parcel please', consent: true };

describe('validateContact', () => {
  it('accepts a valid message and trims it', () => {
    expect(validateContact({ ...valid, message: '  Where is my parcel now  ' })).toEqual({
      ok: true,
      input: { topic: 'order', message: 'Where is my parcel now' },
    });
  });

  it('reports every problem at once', () => {
    const r = validateContact({});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.fieldErrors).sort()).toEqual(['consent', 'message', 'topic']);
  });

  it('rejects an unknown topic, a short or long message and missing consent', () => {
    const bad = (patch: Record<string, unknown>) => validateContact({ ...valid, ...patch });
    expect(bad({ topic: 'weather' })).toMatchObject({ ok: false, fieldErrors: { topic: expect.any(String) } });
    expect(bad({ message: 'too short' })).toMatchObject({ ok: false, fieldErrors: { message: expect.stringContaining('at least 10') } });
    expect(bad({ message: 'x'.repeat(1001) })).toMatchObject({ ok: false, fieldErrors: { message: expect.stringContaining('at most 1000') } });
    expect(bad({ consent: false })).toMatchObject({ ok: false, fieldErrors: { consent: expect.any(String) } });
    expect(bad({ consent: 'true' })).toMatchObject({ ok: false });
  });

  it('treats a message of only spaces as empty', () => {
    expect(validateContact({ ...valid, message: '            ' })).toMatchObject({
      ok: false,
      fieldErrors: { message: 'Message is required.' },
    });
  });
});
