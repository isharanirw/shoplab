import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ApiError, toErrorBody } from '../lib/errors';

export const apiNotFound: RequestHandler = (req) => {
  throw new ApiError('NOT_FOUND', `No route for ${req.method} ${req.path}`);
};

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  let apiError: ApiError;
  if (err instanceof ApiError) {
    apiError = err;
  } else if (err && typeof err === 'object' && (err as { type?: string }).type === 'entity.parse.failed') {
    apiError = new ApiError('VALIDATION_ERROR', 'Request body is not valid JSON.');
  } else if (err && typeof err === 'object' && (err as { type?: string }).type === 'entity.too.large') {
    apiError = new ApiError('VALIDATION_ERROR', 'Request body is too large.');
  } else {
    process.stderr.write(`${new Date().toISOString()} req=${req.id} unhandled error: ${(err as Error)?.stack ?? String(err)}\n`);
    apiError = new ApiError('INTERNAL_ERROR', 'Something went wrong on our side. Please try again.');
  }
  if (apiError.headers) {
    for (const [name, value] of Object.entries(apiError.headers)) res.setHeader(name, value);
  }
  res.status(apiError.status).json(toErrorBody(apiError));
};
