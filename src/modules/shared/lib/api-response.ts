import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AppError, RateLimitError, ValidationError, toAppError } from './errors';
import type { Result } from './result';
import { logger } from './logger';

// Standardized JSON envelope used by EVERY route handler.
//   success -> { ok: true,  data: <payload> }
//   error   -> { ok: false, error: { code, message, fieldErrors? } }

export type ApiSuccess<T> = { ok: true; data: T };
export type ApiError = {
  ok: false;
  error: { code: string; message: string; fieldErrors?: Record<string, string[] | undefined> };
};
export type ApiResponseBody<T> = ApiSuccess<T> | ApiError;

/** 2xx success envelope. */
export function apiSuccess<T>(data: T, status = 200): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ ok: true, data } as ApiSuccess<T>, { status });
}

/** Map a typed AppError to the standardized error envelope + correct HTTP status. */
export function apiError(error: AppError): NextResponse<ApiError> {
  const body: ApiError = {
    ok: false,
    error: {
      code: error.code,
      message: error.message,
      ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}),
    },
  };
  const headers: Record<string, string> = {};
  if (error instanceof RateLimitError && error.retryAfterSeconds != null) {
    headers['Retry-After'] = String(error.retryAfterSeconds);
  }
  // Log server-side detail; only the safe code/message reaches the client (never `cause`/stack).
  if (error.httpStatus >= 500) {
    const cause = error.cause;
    logger.error('request_failed', {
      code: error.code,
      kind: error.kind,
      stack: error.stack,
      ...(cause instanceof Error
        ? { causeMessage: cause.message, causeStack: cause.stack, causeName: cause.name }
        : cause !== undefined
          ? { cause: String(cause) }
          : {}),
    });
  }
  return NextResponse.json(body, { status: error.httpStatus, headers });
}

/** Build a 400 from a ZodError with structured field errors. */
export function apiValidationError(error: z.ZodError): NextResponse<ApiError> {
  const { fieldErrors } = z.flattenError(error);
  return apiError(new ValidationError('Invalid input.', fieldErrors));
}

/** Map a service Result to a response. Success -> data envelope; Err -> mapped error. */
export function respond<T>(result: Result<T>, successStatus = 200): NextResponse<ApiResponseBody<T>> {
  return result.ok ? apiSuccess(result.data, successStatus) : apiError(result.error);
}

/** Last-resort wrapper: coerce any unexpected throw into a safe 500 envelope. */
export function apiUnexpected(error: unknown): NextResponse<ApiError> {
  return apiError(toAppError(error));
}
