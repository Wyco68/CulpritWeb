// Typed domain errors. Services return these inside a Result; the API boundary maps
// error.kind -> HTTP status. Messages here are SAFE to send to clients (no internals).

export type ErrorKind =
  | 'validation'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'rate_limit'
  | 'integration'
  | 'internal';

export type FieldErrors = Record<string, string[] | undefined>;

const STATUS_BY_KIND: Record<ErrorKind, number> = {
  validation: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  rate_limit: 429,
  integration: 502,
  internal: 500,
};

export class AppError extends Error {
  readonly kind: ErrorKind;
  readonly code: string;
  readonly fieldErrors?: FieldErrors;

  constructor(
    kind: ErrorKind,
    code: string,
    message: string,
    options?: { fieldErrors?: FieldErrors; cause?: unknown },
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = new.target.name;
    this.kind = kind;
    this.code = code;
    this.fieldErrors = options?.fieldErrors;
  }

  get httpStatus(): number {
    return STATUS_BY_KIND[this.kind];
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Invalid input.', fieldErrors?: FieldErrors) {
    super('validation', 'validation_error', message, { fieldErrors });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required.') {
    super('unauthorized', 'unauthorized', message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action.') {
    super('forbidden', 'forbidden', message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'The requested resource was not found.') {
    super('not_found', 'not_found', message);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'The request conflicts with the current state.') {
    super('conflict', 'conflict', message);
  }
}

export class RateLimitError extends AppError {
  readonly retryAfterSeconds?: number;

  constructor(message = 'Too many requests. Please try again later.', retryAfterSeconds?: number) {
    super('rate_limit', 'rate_limited', message);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class IntegrationError extends AppError {
  constructor(message = 'An upstream service failed.', cause?: unknown) {
    super('integration', 'integration_error', message, { cause });
  }
}

export class InternalError extends AppError {
  constructor(message = 'An unexpected error occurred.', cause?: unknown) {
    super('internal', 'internal_error', message, { cause });
  }
}

/** Coerce an unknown thrown value into an AppError without leaking internals. */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  return new InternalError('An unexpected error occurred.', error);
}
