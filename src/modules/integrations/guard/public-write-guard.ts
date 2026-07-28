import { getClientIp } from '@/modules/shared/lib/request';
import { RateLimitError, type AppError } from '@/modules/shared/lib/errors';
import { err, ok, type Result } from '@/modules/shared/lib/result';
import { getRateLimiter, type RateLimiter } from '../rate-limit/rate-limiter';
import { getTurnstileVerifier, type TurnstileVerifier } from '../turnstile/turnstile-verifier';

// Reusable edge guard for public mutating routes: verify the Turnstile token first (single-use,
// server-side), then apply the sliding-window rate limit keyed by IP + email + route. Both no-op
// gracefully when their env is unset (dev). No domain logic — pure boundary protection.

export type PublicWriteGuardDeps = {
  rateLimiter?: RateLimiter;
  turnstile?: TurnstileVerifier;
};

export async function guardPublicWrite(
  input: { headers: Headers; email: string; route: string; turnstileToken?: string },
  deps: PublicWriteGuardDeps = {},
): Promise<Result<true, AppError>> {
  const turnstile = deps.turnstile ?? getTurnstileVerifier();
  const rateLimiter = deps.rateLimiter ?? getRateLimiter();

  // 1) Bot challenge before the rate-limit-expensive work.
  const verified = await turnstile.verify(input.turnstileToken ?? '', getClientIp(input.headers));
  if (!verified.ok) return verified;

  // 2) Rate limit by IP + email + route.
  const ip = getClientIp(input.headers);
  const key = `${input.route}:${ip}:${input.email.toLowerCase()}`;
  const { success, reset } = await rateLimiter.limit(key);
  if (!success) {
    const retryAfter = Math.max(0, Math.ceil((reset - Date.now()) / 1000));
    return err(new RateLimitError('Too many requests. Please try again later.', retryAfter));
  }
  return ok(true);
}
