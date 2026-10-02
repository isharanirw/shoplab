import { describe, expect, it } from 'vitest';
import { ApiRequestError } from '../api/client';
import { failureOf, isTransientError, isTransientStatus } from './failure';

const apiError = (status: number, message = 'Nope') => new ApiRequestError(status, 'CODE', message, {}, null);

describe('transient failures', () => {
  it('treats network errors, rate limits and server errors as transient', () => {
    for (const status of [0, 429, 500, 503]) expect(isTransientStatus(status)).toBe(true);
  });

  it('does not treat client errors as transient', () => {
    for (const status of [400, 401, 403, 404, 409, 423]) expect(isTransientStatus(status)).toBe(false);
  });

  it('only classifies API request errors', () => {
    expect(isTransientError(apiError(503))).toBe(true);
    expect(isTransientError(new Error('x'))).toBe(false);
    expect(isTransientError('x')).toBe(false);
  });
});

describe('failureOf', () => {
  const retry = () => undefined;

  it('offers Retry for a transient error and keeps its message', () => {
    expect(failureOf(apiError(503, 'Try later'), 'Fallback', retry)).toEqual({ message: 'Try later', retry });
  });

  it('leaves Retry out for an error that repeating will not fix', () => {
    expect(failureOf(apiError(409, 'Only 3 in stock.'), 'Fallback', retry)).toEqual({ message: 'Only 3 in stock.', retry: undefined });
  });

  it('falls back to the given message for values that are not errors', () => {
    expect(failureOf('boom', 'Fallback', retry)).toEqual({ message: 'Fallback', retry: undefined });
  });
});
