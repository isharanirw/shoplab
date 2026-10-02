import { ApiRequestError } from '../api/client';

/** A failed action: the message to show and, when trying again could help, what Retry does. */
export interface Failure {
  message: string;
  retry?: () => void;
}

/** Network failures, server errors and rate limits can pass; a 400 or 404 will not change by repeating it. */
export function isTransientStatus(status: number): boolean {
  return status === 0 || status === 429 || status >= 500;
}

export function isTransientError(err: unknown): boolean {
  return err instanceof ApiRequestError && isTransientStatus(err.status);
}

/** Builds a Failure from a thrown error. Retry is only offered when the error is the kind that can pass. */
export function failureOf(err: unknown, fallback: string, retry?: () => void): Failure {
  const message = err instanceof Error && err.message !== '' ? err.message : fallback;
  return { message, retry: retry && isTransientError(err) ? retry : undefined };
}
