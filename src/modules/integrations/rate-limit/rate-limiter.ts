import { env } from '@/modules/shared/lib/env.server';
import { logger } from '@/modules/shared/lib/logger';

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  /** Epoch ms when the window resets. */
  reset: number;
}

// Sliding-window limiter for public mutating routes (keyed by IP + email + route).
export interface RateLimiter {
  limit(key: string): Promise<RateLimitResult>;
}

/** No-op limiter for dev/test when Upstash env is unset — always allows. */
export class NoopRateLimiter implements RateLimiter {
  async limit(): Promise<RateLimitResult> {
    return { success: true, remaining: Number.MAX_SAFE_INTEGER, reset: Date.now() };
  }
}

/**
 * Upstash sliding-window limiter with a small in-process cache in front to absorb bursts and
 * cut Redis round-trips. Constructed lazily so the SDK only loads when configured.
 */
export class UpstashRateLimiter implements RateLimiter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- @upstash/ratelimit instance; typed via dynamic import
  private ratelimitPromise: Promise<any> | undefined;

  constructor(
    private readonly url: string,
    private readonly token: string,
    private readonly options: { limit: number; windowSeconds: number } = { limit: 5, windowSeconds: 3600 },
  ) {}

  private async getRatelimit() {
    if (!this.ratelimitPromise) {
      this.ratelimitPromise = (async () => {
        const [{ Ratelimit }, { Redis }] = await Promise.all([
          import('@upstash/ratelimit'),
          import('@upstash/redis'),
        ]);
        const redis = new Redis({ url: this.url, token: this.token });
        return new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(this.options.limit, `${this.options.windowSeconds} s`),
          ephemeralCache: new Map(),
          prefix: 'culprit:rl',
        });
      })();
    }
    return this.ratelimitPromise;
  }

  async limit(key: string): Promise<RateLimitResult> {
    try {
      const ratelimit = await this.getRatelimit();
      const { success, remaining, reset } = await ratelimit.limit(key);
      return { success, remaining, reset };
    } catch (cause) {
      // Fail OPEN on limiter outage: never block a legitimate request because Redis is down.
      logger.error('ratelimit_unavailable', { key: 'redacted' });
      void cause;
      return { success: true, remaining: 0, reset: Date.now() };
    }
  }
}

let cached: RateLimiter | undefined;

export function getRateLimiter(): RateLimiter {
  if (cached) return cached;
  cached =
    env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
      ? new UpstashRateLimiter(env.UPSTASH_REDIS_REST_URL, env.UPSTASH_REDIS_REST_TOKEN)
      : new NoopRateLimiter();
  return cached;
}
