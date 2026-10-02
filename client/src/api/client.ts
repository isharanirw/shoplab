export interface ApiErrorBody {
  error?: { code?: string; message?: string; fieldErrors?: Record<string, string> };
}

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors: Record<string, string>;
  readonly retryAfterSeconds: number | null;

  constructor(status: number, code: string, message: string, fieldErrors: Record<string, string>, retryAfter: number | null) {
    super(message);
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
    this.retryAfterSeconds = retryAfter;
  }
}

export interface ApiOptions {
  method?: string;
  /** Sent as JSON. */
  body?: unknown;
  /** Sent as multipart/form-data (the browser adds the boundary header itself). */
  formData?: FormData;
  signal?: AbortSignal;
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: options.method ?? 'GET',
      credentials: 'same-origin',
      signal: options.signal,
      headers: options.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: options.formData ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined),
    });
  } catch {
    throw new ApiRequestError(0, 'NETWORK_ERROR', 'Could not reach the server. Check your connection and try again.', {}, null);
  }
  if (response.status === 204) return undefined as T;

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const err = (payload as ApiErrorBody | null)?.error;
    const retry = Number(response.headers.get('Retry-After'));
    throw new ApiRequestError(
      response.status,
      err?.code ?? 'UNKNOWN',
      err?.message ?? 'Something went wrong. Please try again.',
      err?.fieldErrors ?? {},
      Number.isFinite(retry) && retry > 0 ? retry : null,
    );
  }
  return payload as T;
}
