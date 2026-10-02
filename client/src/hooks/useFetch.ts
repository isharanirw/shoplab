import { useCallback, useEffect, useState } from 'react';
import { api, ApiRequestError } from '../api/client';

export type FetchState<T> =
  | { status: 'loading'; data: null; error: null }
  | { status: 'success'; data: T; error: null }
  | { status: 'error'; data: null; error: ApiRequestError };

export type FetchResult<T> = FetchState<T> & { retry: () => void };

/**
 * GETs a JSON path and reports loading, success or error. Passing a new path starts a new
 * request and cancels the old one; passing null does nothing. `retry` repeats the same request.
 */
export function useFetch<T>(path: string | null): FetchResult<T> {
  const [state, setState] = useState<FetchState<T>>({ status: 'loading', data: null, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (path === null) return;
    const controller = new AbortController();
    setState({ status: 'loading', data: null, error: null });
    api<T>(path, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setState({ status: 'success', data, error: null });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const error =
          err instanceof ApiRequestError
            ? err
            : new ApiRequestError(0, 'UNKNOWN', 'Something went wrong. Please try again.', {}, null);
        setState({ status: 'error', data: null, error });
      });
    return () => controller.abort();
  }, [path, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, retry } as FetchResult<T>;
}
