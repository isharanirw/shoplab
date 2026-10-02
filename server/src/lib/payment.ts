export type PaymentOutcome = 'success' | 'declined';

export interface PaymentToken {
  outcome: PaymentOutcome;
  last4: string;
}

/**
 * The simulated payment frame turns a card into a token that carries only the outcome and the last
 * four digits: `tok_ok_4242` (approved) or `tok_declined_0002` (declined). The server never sees a
 * card number or CVC. Anything that is not one of these two tokens is invalid.
 */
export function parsePaymentToken(token: unknown): PaymentToken | null {
  if (token === 'tok_ok_4242') return { outcome: 'success', last4: '4242' };
  if (token === 'tok_declined_0002') return { outcome: 'declined', last4: '0002' };
  return null;
}
