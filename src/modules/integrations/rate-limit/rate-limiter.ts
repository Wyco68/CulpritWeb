export interface RateLimitResult {
  success: boolean;
  remaining: number;
  /** Epoch ms when the window resets. */
  reset: number;
}

// Fixed/sliding-window limiter for public mutating routes (keyed by IP + email + route) and for
// the middleware fallback layer (keyed by IP + route).
export interface RateLimiter {
  limit(key: string): Promise<RateLimitResult>;
}

/** No-op limiter — always allows. Kept exported for tests to inject explicitly via `deps`. */
export class NoopRateLimiter implements RateLimiter {
  async limit(): Promise<RateLimitResult> {
    return { success: true, remaining: Number.MAX_SAFE_INTEGER, reset: Date.now() };
  }
}

/**
 * In-process fixed-window limiter. Defense-in-depth behind the Cloudflare edge WAF rate-limiting
 * rule (see ADR-008), not the primary control — per-instance (non-shared) state is an accepted
 * limitation for this traffic profile (single admin, low volume).
 */
export class InMemoryRateLimiter implements RateLimiter {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();

  constructor(private readonly options: { limit: number; windowSeconds: number }) {}

  async limit(key: string): Promise<RateLimitResult> {
    const now = Date.now();
    const windowMs = this.options.windowSeconds * 1000;
    const bucket = this.buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      // Lazily evict/replace expired entries on access instead of a background sweep timer.
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      return { success: true, remaining: this.options.limit - 1, reset: now + windowMs };
    }

    if (bucket.count >= this.options.limit) {
      return { success: false, remaining: 0, reset: bucket.resetAt };
    }

    bucket.count += 1;
    return { success: true, remaining: this.options.limit - bucket.count, reset: bucket.resetAt };
  }
}

// Default matches the previous Upstash default (see git history) so existing callers
// (turnstile route, public-write-guard) keep the same effective behavior unchanged.
const DEFAULT_OPTIONS = { limit: 5, windowSeconds: 3600 };

// One singleton per distinct {limit, windowSeconds} config, so different call sites (e.g. the
// auth sign-in vs admin-mutation categories in middleware.ts) each get a stable, independently
// windowed limiter without reintroducing env-gated branching.
const instances = new Map<string, RateLimiter>();

export function getRateLimiter(options: { limit: number; windowSeconds: number } = DEFAULT_OPTIONS): RateLimiter {
  const cacheKey = `${options.limit}:${options.windowSeconds}`;
  let limiter = instances.get(cacheKey);
  if (!limiter) {
    limiter = new InMemoryRateLimiter(options);
    instances.set(cacheKey, limiter);
  }
  return limiter;
}
