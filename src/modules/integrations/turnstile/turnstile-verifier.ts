import { env } from '@/modules/shared/lib/env.server';
import { logger } from '@/modules/shared/lib/logger';
import { IntegrationError, ValidationError } from '@/modules/shared/lib/errors';
import { err, ok, type Result } from '@/modules/shared/lib/result';

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

// Cloudflare Turnstile. The client widget protects nothing — server-side siteverify is mandatory.
// Tokens are single-use and expire in 300s.
export interface TurnstileVerifier {
  verify(token: string, remoteIp?: string): Promise<Result<true, ValidationError | IntegrationError>>;
}

/** No-op verifier for dev/test when TURNSTILE_SECRET_KEY is unset — always passes, logs. */
export class NoopTurnstileVerifier implements TurnstileVerifier {
  async verify(): Promise<Result<true, ValidationError | IntegrationError>> {
    logger.warn('turnstile_noop', { note: 'TURNSTILE_SECRET_KEY unset; skipping bot check' });
    return ok(true);
  }
}

export class CloudflareTurnstileVerifier implements TurnstileVerifier {
  constructor(private readonly secretKey: string) {}

  async verify(
    token: string,
    remoteIp?: string,
  ): Promise<Result<true, ValidationError | IntegrationError>> {
    if (!token) return err(new ValidationError('Bot challenge missing.', { turnstileToken: ['Required'] }));
    try {
      const body = new URLSearchParams({ secret: this.secretKey, response: token });
      if (remoteIp) body.set('remoteip', remoteIp);
      const res = await fetch(SITEVERIFY_URL, { method: 'POST', body });
      const data = (await res.json()) as { success: boolean };
      if (!data.success) {
        return err(new ValidationError('Bot challenge failed.', { turnstileToken: ['Verification failed'] }));
      }
      return ok(true);
    } catch (cause) {
      return err(new IntegrationError('Bot verification is unavailable.', cause));
    }
  }
}

let cached: TurnstileVerifier | undefined;

export function getTurnstileVerifier(): TurnstileVerifier {
  if (cached) return cached;
  cached = env.TURNSTILE_SECRET_KEY
    ? new CloudflareTurnstileVerifier(env.TURNSTILE_SECRET_KEY)
    : new NoopTurnstileVerifier();
  return cached;
}
