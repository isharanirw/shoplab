import { describe, expect, it } from 'vitest';
import { parsePaymentToken } from './payment';

describe('payment tokens', () => {
  it('recognises the approved and declined test card tokens', () => {
    expect(parsePaymentToken('tok_ok_4242')).toEqual({ outcome: 'success', last4: '4242' });
    expect(parsePaymentToken('tok_declined_0002')).toEqual({ outcome: 'declined', last4: '0002' });
  });

  it('treats everything else as invalid', () => {
    for (const bad of ['', 'tok_ok_1111', 'tok_declined_4242', '4242424242424242', undefined, null, 42]) {
      expect(parsePaymentToken(bad)).toBeNull();
    }
  });
});
