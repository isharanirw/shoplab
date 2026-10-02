/**
 * Test-card handling for the simulated payment frame. No real processing happens. The full card
 * number and CVC stay inside the frame: only a token (outcome and last four digits) is posted to the
 * parent page, and only that token is sent to the server.
 */

export const APPROVED_CARD = '4242424242424242';
export const DECLINED_CARD = '4000000000000002';

export interface CardInput {
  name: string;
  number: string;
  expiry: string;
  cvc: string;
}

export type CardErrors = Partial<Record<keyof CardInput, string>>;

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

/** "4242424242424242" becomes "4242 4242 4242 4242" (groups of four, up to 16 digits). */
export function formatCardNumber(value: string): string {
  return (digitsOnly(value).slice(0, 16).match(/.{1,4}/g) ?? []).join(' ');
}

/** Digits typed into the expiry box become MM/YY, inserting the slash after the month. */
export function formatExpiry(value: string): string {
  const digits = digitsOnly(value).slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}

export function validateCardName(value: string): string | null {
  const name = value.trim();
  if (name === '') return 'Enter the name on the card.';
  if (name.length < 2) return 'Name on card must be at least 2 characters.';
  if (name.length > 60) return 'Name on card must be at most 60 characters.';
  return null;
}

/** Only the two test cards are valid; every other number is rejected as invalid. */
export function validateCardNumber(value: string): string | null {
  if (value.trim() === '') return 'Enter the card number.';
  if (!/^[\d ]+$/.test(value)) return 'Card number can only contain digits and spaces.';
  const digits = digitsOnly(value);
  if (digits.length !== 16) return 'Card number must have 16 digits.';
  if (digits !== APPROVED_CARD && digits !== DECLINED_CARD) return 'This card number is invalid.';
  return null;
}

/** MM/YY, a real month, and not earlier than the current month (UTC). */
export function validateExpiry(value: string, now: Date): string | null {
  const text = value.trim();
  if (text === '') return 'Enter the expiry date.';
  const match = /^(\d{2})\/(\d{2})$/.exec(text);
  if (!match) return 'Use the format MM/YY.';
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  if (month < 1 || month > 12) return 'The month must be from 01 to 12.';
  const thisYear = now.getUTCFullYear();
  const thisMonth = now.getUTCMonth() + 1;
  if (year < thisYear || (year === thisYear && month < thisMonth)) return 'This card has expired.';
  if (year > thisYear + 20) return 'Enter a valid expiry year.';
  return null;
}

export function validateCvc(value: string): string | null {
  const cvc = value.trim();
  if (cvc === '') return 'Enter the security code.';
  if (!/^\d{3}$/.test(cvc)) return 'The security code must be 3 digits.';
  return null;
}

export function validateCard(input: CardInput, now: Date): CardErrors {
  const errors: CardErrors = {};
  const name = validateCardName(input.name);
  if (name) errors.name = name;
  const number = validateCardNumber(input.number);
  if (number) errors.number = number;
  const expiry = validateExpiry(input.expiry, now);
  if (expiry) errors.expiry = expiry;
  const cvc = validateCvc(input.cvc);
  if (cvc) errors.cvc = cvc;
  return errors;
}

export interface CardToken {
  token: string;
  last4: string;
}

/** The token for a valid test card number, or null for anything else. */
export function tokenFor(number: string): CardToken | null {
  const digits = digitsOnly(number);
  if (digits === APPROVED_CARD) return { token: 'tok_ok_4242', last4: '4242' };
  if (digits === DECLINED_CARD) return { token: 'tok_declined_0002', last4: '0002' };
  return null;
}
