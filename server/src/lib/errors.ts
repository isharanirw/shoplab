export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'INVALID_CREDENTIALS'
  | 'PAYMENT_DECLINED'
  | 'FORBIDDEN'
  | 'PAYLOAD_TOO_LARGE'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'ACCOUNT_LOCKED'
  | 'RATE_LIMITED'
  | 'SERVICE_UNAVAILABLE'
  | 'INTERNAL_ERROR';

const STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  INVALID_CREDENTIALS: 401,
  PAYMENT_DECLINED: 402,
  FORBIDDEN: 403,
  PAYLOAD_TOO_LARGE: 413,
  NOT_FOUND: 404,
  CONFLICT: 409,
  ACCOUNT_LOCKED: 423,
  RATE_LIMITED: 429,
  SERVICE_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly fieldErrors?: Record<string, string>;
  readonly headers?: Record<string, string>;

  constructor(code: ErrorCode, message: string, opts: { fieldErrors?: Record<string, string>; headers?: Record<string, string> } = {}) {
    super(message);
    this.code = code;
    this.status = STATUS[code];
    this.fieldErrors = opts.fieldErrors;
    this.headers = opts.headers;
  }
}

export interface ErrorBody {
  error: { code: ErrorCode; message: string; fieldErrors?: Record<string, string> };
}

export function toErrorBody(err: ApiError): ErrorBody {
  const body: ErrorBody = { error: { code: err.code, message: err.message } };
  if (err.fieldErrors) body.error.fieldErrors = err.fieldErrors;
  return body;
}
