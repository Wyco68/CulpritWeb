import { describe, expect, it } from 'vitest';
import {
  authErrorMessage,
  formatWait,
  isChallengeExpired,
  NETWORK_ERROR_CODE,
  parseRetryAfter,
  resetRequestErrorMessage,
  runAuthRequest,
} from '../auth-error-message';
import { EMAIL_DELIVERY_FAILED, EMAIL_NOT_CONFIGURED } from '../../auth-policy';

const FALLBACK = 'Something went wrong.';

describe('authErrorMessage', () => {
  it.each([
    ['INVALID_CODE', 400, "That code isn't right"],
    ['OTP_HAS_EXPIRED', 400, 'That code has expired. Send a new code'],
    ['TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE', 400, 'Send a new code'],
    ['INVALID_TWO_FACTOR_COOKIE', 401, 'Enter your password again'],
    ['INVALID_BACKUP_CODE', 401, 'backup code'],
    ['INVALID_PASSWORD', 400, "That password isn't right."],
    ['INVALID_OTP', 400, "That code isn't right"],
    ['OTP_EXPIRED', 400, 'Request a new code'],
    ['TOO_MANY_ATTEMPTS', 403, 'Request a new code'],
    ['PASSWORD_TOO_SHORT', 400, 'Use at least 8 characters.'],
    ['PASSWORD_TOO_LONG', 400, 'Use at most 128 characters.'],
    ['TWO_FACTOR_SETUP_REQUIRED', 400, 'Enter your password to start turning on'],
    ['MISSING_RESPONSE', 400, "Couldn't verify you're human. Please try again."],
    ['VERIFICATION_FAILED', 403, "Couldn't verify you're human. Please try again."],
    ['UNKNOWN_ERROR', 500, 'Please try again later.'],
    ['CAPTCHA_NOT_CONFIGURED', 503, 'Password reset is unavailable right now.'],
  ])('maps %s to friendly copy', (code, status, expected) => {
    const message = authErrorMessage({ code, status, message: 'raw server text' }, FALLBACK);
    expect(message).toContain(expected);
    expect(message).not.toContain('raw server text');
  });

  it('uses the shared policy copy for the email delivery codes', () => {
    expect(authErrorMessage({ code: 'EMAIL_DELIVERY_FAILED', status: 503 }, FALLBACK)).toBe(
      EMAIL_DELIVERY_FAILED.message,
    );
    expect(authErrorMessage({ code: 'EMAIL_NOT_CONFIGURED', status: 400 }, FALLBACK)).toBe(
      EMAIL_NOT_CONFIGURED.message,
    );
  });

  it('reports the account lock specifically, even though it is a 429', () => {
    expect(authErrorMessage({ code: 'ACCOUNT_TEMPORARILY_LOCKED', status: 429 }, FALLBACK)).toMatch(
      /locked for 15 minutes/,
    );
  });

  it('treats a 429 without a code (the middleware limit) as a generic rate limit', () => {
    expect(authErrorMessage({ status: 429 }, FALLBACK)).toBe(
      'Too many attempts. Please try again in a few minutes.',
    );
    // The middleware body is `{ ok: false, error: { code: 'rate_limited' } }`; its nested code
    // never reaches `error.code`, but an unknown top-level code must not hide the 429 either.
    expect(authErrorMessage({ status: 429, code: 'rate_limited' }, FALLBACK)).toBe(
      'Too many attempts. Please try again in a few minutes.',
    );
  });

  it('falls back to the caller copy for an unmapped error, never the raw message', () => {
    expect(authErrorMessage({ status: 500, message: 'Internal stack trace' }, FALLBACK)).toBe(
      FALLBACK,
    );
    expect(authErrorMessage({}, FALLBACK)).toBe(FALLBACK);
  });
});

describe('isChallengeExpired', () => {
  it('is true only for an invalid two-factor cookie', () => {
    expect(isChallengeExpired({ code: 'INVALID_TWO_FACTOR_COOKIE', status: 401 })).toBe(true);
    expect(isChallengeExpired({ code: 'INVALID_CODE', status: 401 })).toBe(false);
    expect(isChallengeExpired({ status: 429 })).toBe(false);
  });
});

describe('runAuthRequest', () => {
  it('passes data through', async () => {
    await expect(runAuthRequest(async () => ({ data: { ok: 1 }, error: null }))).resolves.toEqual({
      data: { ok: 1 },
      error: null,
    });
  });

  it('passes an HTTP error through', async () => {
    const error = { status: 401, code: 'INVALID_CODE' };
    await expect(runAuthRequest(async () => ({ data: null, error }))).resolves.toEqual({
      data: null,
      error,
    });
  });

  it('turns a rejected fetch into a network error with friendly copy', async () => {
    const result = await runAuthRequest(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(result.error).toEqual({ code: NETWORK_ERROR_CODE });
    expect(authErrorMessage(result.error!, FALLBACK)).toMatch(/Couldn't reach the server/);
  });
});

describe('parseRetryAfter', () => {
  it('reads delta-seconds from Retry-After or Better Auth X-Retry-After', () => {
    expect(parseRetryAfter(new Headers({ 'Retry-After': '120' }))).toBe(120);
    expect(parseRetryAfter(new Headers({ 'X-Retry-After': '30' }))).toBe(30);
  });

  it('reads an HTTP date relative to now', () => {
    const now = Date.parse('2026-10-03T12:00:00Z');
    const headers = new Headers({ 'Retry-After': 'Sat, 03 Oct 2026 13:00:00 GMT' });
    expect(parseRetryAfter(headers, now)).toBe(3600);
  });

  it('is undefined when absent or unreadable', () => {
    expect(parseRetryAfter(new Headers())).toBeUndefined();
    expect(parseRetryAfter(new Headers({ 'Retry-After': 'soon' }))).toBeUndefined();
  });
});

describe('formatWait', () => {
  it.each([
    [0, 'about a minute'],
    [45, 'about a minute'],
    [240, 'about 4 minutes'],
    [3600, 'about an hour'],
    [3601, 'about 2 hours'],
    [86_400, 'about 24 hours'],
  ])('%i s → %s', (seconds, expected) => {
    expect(formatWait(seconds)).toBe(expected);
  });
});

describe('resetRequestErrorMessage', () => {
  it('uses Retry-After for a 429, and never claims "a few minutes" without one', () => {
    expect(resetRequestErrorMessage({ status: 429, retryAfterSeconds: 7200 }, FALLBACK)).toBe(
      'Too many requests. Please try again in about 2 hours.',
    );
    expect(resetRequestErrorMessage({ status: 429 }, FALLBACK)).toBe(
      'Too many requests. Please try again later.',
    );
  });

  it('defers to the shared mapping for anything else', () => {
    expect(resetRequestErrorMessage({ status: 403, code: 'VERIFICATION_FAILED' }, FALLBACK)).toBe(
      "Couldn't verify you're human. Please try again.",
    );
    expect(resetRequestErrorMessage({ status: 500 }, FALLBACK)).toBe(FALLBACK);
  });
});
