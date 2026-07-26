import type { AppError } from './errors';

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
