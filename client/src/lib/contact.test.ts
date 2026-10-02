import { describe, expect, it } from 'vitest';
import { validateContactField, validateContactValues } from './contact';

const valid = { topic: 'order', message: 'Where is my parcel please', consent: true };

describe('validateContactValues', () => {
  it('accepts a complete form', () => {
    expect(validateContactValues(valid)).toEqual({});
  });

  it('reports a missing topic, message and consent', () => {
    expect(Object.keys(validateContactValues({ topic: '', message: '', consent: false })).sort()).toEqual(['consent', 'message', 'topic']);
  });

  it('checks the message length after trimming', () => {
    expect(validateContactField('message', { ...valid, message: '  short   ' })).toContain('at least 10');
    expect(validateContactField('message', { ...valid, message: 'x'.repeat(1001) })).toContain('at most 1000');
    expect(validateContactField('message', { ...valid, message: 'x'.repeat(10) })).toBeNull();
  });

  it('rejects a topic that is not in the list', () => {
    expect(validateContactField('topic', { ...valid, topic: 'weather' })).not.toBeNull();
  });
});
