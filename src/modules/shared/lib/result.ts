import { toAppError, type AppError } from './errors';

// Domain code returns a typed Result for expected failures instead of throwing.
// Only truly exceptional/infra conditions throw (and are caught + mapped by the service).
export type Ok<T> = { ok: true; data: T };
export type Err<E> = { ok: false; error: E };
export type Result<T, E = AppError> = Ok<T> | Err<E>;

export function ok<T>(data: T): Ok<T> {
  return { ok: true, data };
}

export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

/** Transform the success payload of a Result, leaving the error branch untouched. */
export function mapResult<T, U, E>(result: Result<T, E>, fn: (data: T) => U): Result<U, E> {
  return result.ok ? { ok: true, data: fn(result.data) } : result;
}

/** The success payload, or `fallback` when the Result carries an error. */
export function unwrapOr<T, E>(result: Result<T, E>, fallback: T): T {
  return result.ok ? result.data : fallback;
}

/**
 * Run an operation that may throw and return it on the Result channel. Services use this so every
 * method reads as its business logic alone; a thrown `AppError` (e.g. `NotFoundError`) passes
 * through unchanged, and anything else becomes a safe `InternalError`.
 */
export async function attempt<T>(operation: () => Promise<T>): Promise<Result<T>> {
  try {
    return ok(await operation());
  } catch (error) {
    return err(toAppError(error));
  }
}
