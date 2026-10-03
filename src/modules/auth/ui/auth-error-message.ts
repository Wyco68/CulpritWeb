import {
  CAPTCHA_NOT_CONFIGURED,
  EMAIL_DELIVERY_FAILED,
  EMAIL_NOT_CONFIGURED,
  PASSWORD_POLICY,
  TWO_FACTOR_SETUP_REQUIRED,
} from '../auth-policy';

// One place that turns a Better Auth client error into the sentence the admin reads (ADR-022).
//
// The client answers `{ data, error }` with `error = { status, statusText, code?, message? }`.
// `code` is Better Auth's own (or ours, from ./auth-security.ts); the raw `message` is never shown
// when a code is mapped here, since several are written for developers ("Invalid two factor
// cookie"). An unmapped code falls back to the caller's sentence, not to the raw message.
//
// 429 comes in two shapes: the two-factor plugin's account lock (`ACCOUNT_TEMPORARILY_LOCKED`) and
// the middleware's per-IP limit, whose `{ ok: false, error: { code: 'rate_limited' } }` body leaves
// `error.code` undefined on the client — so the status, not the code, decides that case.

/** The parts of a Better Auth client error this module reads. */
export type AuthClientError = {
  status?: number;
  code?: string;
  message?: string;
  /** Seconds from the response's `Retry-After`, when the caller read it (see parseRetryAfter). */
  retryAfterSeconds?: number;
};

/** Stands in for a request that never reached the server (offline, DNS, blocked). */
export const NETWORK_ERROR_CODE = 'NETWORK_ERROR';

const RATE_LIMITED = 'Too many attempts. Please try again in a few minutes.';

const MESSAGES: Readonly<Record<string, string>> = {
  [NETWORK_ERROR_CODE]: "Couldn't reach the server. Check your connection and try again.",
  // Password sign-in.
  INVALID_EMAIL_OR_PASSWORD: 'That email and password combination is incorrect.',
  // Password confirmation on the security settings, which also need a live session.
  INVALID_PASSWORD: "That password isn't right.",
  UNAUTHORIZED: 'Your session has ended. Sign in again to continue.',
  SESSION_NOT_FRESH: 'For your safety, sign in again before changing this.',
  // Two-factor sign-in code.
  INVALID_CODE: "That code isn't right. Check the email and try again.",
  OTP_HAS_EXPIRED: 'That code has expired. Send a new code and try again.',
  TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE: 'Too many wrong tries for this code. Send a new code.',
  INVALID_TWO_FACTOR_COOKIE: 'Your sign-in took too long. Enter your password again.',
  ACCOUNT_TEMPORARILY_LOCKED:
    'Too many failed attempts, so sign-in is locked for 15 minutes. Please try again later.',
  INVALID_BACKUP_CODE: "That backup code isn't valid, or it has already been used.",
  // Turning two-step verification on: the code step was reached without the password step.
  [TWO_FACTOR_SETUP_REQUIRED.code]:
    "Setup didn't finish. Enter your password to start turning on two-step verification again.",
  // Code delivery.
  [EMAIL_DELIVERY_FAILED.code]: EMAIL_DELIVERY_FAILED.message,
  [EMAIL_NOT_CONFIGURED.code]: EMAIL_NOT_CONFIGURED.message,
  // The human check (Turnstile) in front of the password-reset request.
  MISSING_RESPONSE: "Couldn't verify you're human. Please try again.",
  VERIFICATION_FAILED: "Couldn't verify you're human. Please try again.",
  UNKNOWN_ERROR: 'Something went wrong. Please try again later.',
  [CAPTCHA_NOT_CONFIGURED.code]: CAPTCHA_NOT_CONFIGURED.message,
  // Password reset code.
  INVALID_OTP: "That code isn't right. Check the email and try again.",
  OTP_EXPIRED: 'That code has expired. Request a new code and try again.',
  TOO_MANY_ATTEMPTS: 'Too many wrong tries for this code. Request a new code.',
  PASSWORD_TOO_SHORT: `Use at least ${PASSWORD_POLICY.minPasswordLength} characters.`,
  PASSWORD_TOO_LONG: `Use at most ${PASSWORD_POLICY.maxPasswordLength} characters.`,
};

/** The admin-facing sentence for a failed auth request. */
export function authErrorMessage(error: AuthClientError, fallback: string): string {
  const mapped = error.code ? MESSAGES[error.code] : undefined;
  if (mapped) return mapped;
  if (error.status === 429) return RATE_LIMITED;
  return fallback;
}

/**
 * Seconds to wait, from `Retry-After` (our middleware) or `X-Retry-After` (Better Auth's own
 * limiter). Either delta-seconds or an HTTP date. Undefined when absent or unreadable.
 */
export function parseRetryAfter(headers: Headers, now: number = Date.now()): number | undefined {
  const value = (headers.get('retry-after') ?? headers.get('x-retry-after'))?.trim();
  if (!value) return undefined;
  if (/^\d+$/.test(value)) return Number(value);
  const at = Date.parse(value);
  return Number.isNaN(at) ? undefined : Math.max(0, Math.ceil((at - now) / 1000));
}

/** "about 5 minutes", "about 3 hours" — rounded up, never "0". */
export function formatWait(seconds: number): string {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  if (minutes === 1) return 'about a minute';
  if (minutes < 60) return `about ${minutes} minutes`;
  const hours = Math.ceil(minutes / 60);
  return hours === 1 ? 'about an hour' : `about ${hours} hours`;
}

/**
 * The message for a failed password-reset code request. Unlike sign-in, its 429 may be a site-wide
 * cap that lasts up to a day, so "a few minutes" would be wrong: the wait comes from `Retry-After`
 * when the server sent one, and is left open otherwise.
 */
export function resetRequestErrorMessage(error: AuthClientError, fallback: string): string {
  if (error.status !== 429) return authErrorMessage(error, fallback);
  return error.retryAfterSeconds !== undefined
    ? `Too many requests. Please try again in ${formatWait(error.retryAfterSeconds)}.`
    : 'Too many requests. Please try again later.';
}

/** The sign-in challenge is gone (expired or used up): the password has to be entered again. */
export function isChallengeExpired(error: AuthClientError): boolean {
  return error.code === 'INVALID_TWO_FACTOR_COOKIE';
}

type AuthResult<T> = { data: T; error: null } | { data: null; error: AuthClientError };

/**
 * Runs a Better Auth client call and turns a rejected fetch (no response at all) into the same
 * `{ data, error }` shape the client uses for an HTTP error, so callers handle one shape.
 */
export async function runAuthRequest<T>(
  request: () => Promise<{ data: T | null; error: AuthClientError | null }>,
): Promise<AuthResult<T>> {
  try {
    const { data, error } = await request();
    if (error) return { data: null, error };
    if (data === null) return { data: null, error: {} };
    return { data, error: null };
  } catch {
    return { data: null, error: { code: NETWORK_ERROR_CODE } };
  }
}
