/**
 * The messages the payment frame (/payment-frame, same origin) posts to the page that embeds it.
 * `card-accepted` carries the payment token and the last four digits; `card-cleared` tells the page
 * that the details were edited or are not valid, so any earlier token must be forgotten.
 */
export const PAYMENT_MESSAGE_SOURCE = 'shoplab-payment-frame';

export type PaymentFrameMessage =
  | { source: typeof PAYMENT_MESSAGE_SOURCE; type: 'card-accepted'; token: string; last4: string }
  | { source: typeof PAYMENT_MESSAGE_SOURCE; type: 'card-cleared' };

export function acceptedMessage(token: string, last4: string): PaymentFrameMessage {
  return { source: PAYMENT_MESSAGE_SOURCE, type: 'card-accepted', token, last4 };
}

export function clearedMessage(): PaymentFrameMessage {
  return { source: PAYMENT_MESSAGE_SOURCE, type: 'card-cleared' };
}

/** Narrows an unknown `event.data` to a payment frame message; anything else is ignored by the page. */
export function isPaymentFrameMessage(data: unknown): data is PaymentFrameMessage {
  if (!data || typeof data !== 'object') return false;
  const m = data as Record<string, unknown>;
  if (m.source !== PAYMENT_MESSAGE_SOURCE) return false;
  if (m.type === 'card-cleared') return true;
  return m.type === 'card-accepted' && typeof m.token === 'string' && /^tok_[a-z]+_\d{4}$/.test(m.token) && typeof m.last4 === 'string' && /^\d{4}$/.test(m.last4);
}
