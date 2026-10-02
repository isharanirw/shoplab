import { describe, expect, it } from 'vitest';
import { formatCardNumber, formatExpiry, tokenFor, validateCard, validateCardNumber, validateCvc, validateExpiry } from './card';
import { acceptedMessage, clearedMessage, isPaymentFrameMessage } from './paymentFrame';

const NOW = new Date('2026-10-02T12:00:00.000Z');

describe('card number', () => {
  it('accepts the two test cards, with or without spaces', () => {
    expect(validateCardNumber('4242 4242 4242 4242')).toBeNull();
    expect(validateCardNumber('4242424242424242')).toBeNull();
    expect(validateCardNumber('4000 0000 0000 0002')).toBeNull();
  });

  it('rejects any other number as invalid', () => {
    expect(validateCardNumber('4111 1111 1111 1111')).toBe('This card number is invalid.');
    expect(validateCardNumber('4242 4242 4242 4241')).toBe('This card number is invalid.');
  });

  it('rejects empty, short and non-numeric input', () => {
    expect(validateCardNumber('')).toBe('Enter the card number.');
    expect(validateCardNumber('4242')).toBe('Card number must have 16 digits.');
    expect(validateCardNumber('4242-4242-4242-4242')).toBe('Card number can only contain digits and spaces.');
  });

  it('formats in groups of four and caps at 16 digits', () => {
    expect(formatCardNumber('42424242424242429999')).toBe('4242 4242 4242 4242');
    expect(formatCardNumber('4242a42')).toBe('4242 42');
  });
});

describe('expiry and security code', () => {
  it('needs MM/YY and a month that has not passed', () => {
    expect(validateExpiry('10/26', NOW)).toBeNull(); // this month is still valid
    expect(validateExpiry('09/26', NOW)).toBe('This card has expired.');
    expect(validateExpiry('01/30', NOW)).toBeNull();
    expect(validateExpiry('13/30', NOW)).toBe('The month must be from 01 to 12.');
    expect(validateExpiry('1/30', NOW)).toBe('Use the format MM/YY.');
    expect(validateExpiry('', NOW)).toBe('Enter the expiry date.');
    expect(validateExpiry('01/60', NOW)).toBe('Enter a valid expiry year.');
  });

  it('inserts the slash while typing', () => {
    expect(formatExpiry('1')).toBe('1');
    expect(formatExpiry('103')).toBe('10/3');
    expect(formatExpiry('1030')).toBe('10/30');
    expect(formatExpiry('10/30')).toBe('10/30');
  });

  it('requires exactly 3 digits for the security code', () => {
    expect(validateCvc('123')).toBeNull();
    expect(validateCvc('12')).toBe('The security code must be 3 digits.');
    expect(validateCvc('1234')).toBe('The security code must be 3 digits.');
    expect(validateCvc('abc')).toBe('The security code must be 3 digits.');
    expect(validateCvc('')).toBe('Enter the security code.');
  });
});

describe('whole card form and tokens', () => {
  it('reports every bad field together', () => {
    expect(validateCard({ name: '', number: '1', expiry: '', cvc: '' }, NOW)).toEqual({
      name: 'Enter the name on the card.',
      number: 'Card number must have 16 digits.',
      expiry: 'Enter the expiry date.',
      cvc: 'Enter the security code.',
    });
    expect(validateCard({ name: 'Ada Lovelace', number: '4242 4242 4242 4242', expiry: '12/29', cvc: '123' }, NOW)).toEqual({});
  });

  it('turns a card into a token that holds only the outcome and the last four digits', () => {
    expect(tokenFor('4242 4242 4242 4242')).toEqual({ token: 'tok_ok_4242', last4: '4242' });
    expect(tokenFor('4000 0000 0000 0002')).toEqual({ token: 'tok_declined_0002', last4: '0002' });
    expect(tokenFor('4111 1111 1111 1111')).toBeNull();
    expect(JSON.stringify(tokenFor('4242 4242 4242 4242'))).not.toContain('4242424242424242');
  });

  it('recognises only well-formed frame messages', () => {
    expect(isPaymentFrameMessage(acceptedMessage('tok_ok_4242', '4242'))).toBe(true);
    expect(isPaymentFrameMessage(clearedMessage())).toBe(true);
    expect(isPaymentFrameMessage({ type: 'card-accepted', token: 'tok_ok_4242', last4: '4242' })).toBe(false);
    expect(isPaymentFrameMessage({ source: 'shoplab-payment-frame', type: 'card-accepted', token: '4242424242424242', last4: '4242' })).toBe(false);
    expect(isPaymentFrameMessage('hello')).toBe(false);
    expect(isPaymentFrameMessage(null)).toBe(false);
  });
});
