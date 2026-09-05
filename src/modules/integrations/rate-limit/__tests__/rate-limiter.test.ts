import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryRateLimiter, getRateLimiter } from '../rate-limiter';

describe('InMemoryRateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows requests up to the limit within the window', async () => {
    const limiter = new InMemoryRateLimiter({ limit: 3, windowSeconds: 60 });

    const first = await limiter.limit('key-a');
    const second = await limiter.limit('key-a');
    const third = await limiter.limit('key-a');

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(third.success).toBe(true);
    expect(third.remaining).toBe(0);
  });

  it('rejects requests once the limit is exceeded within the window', async () => {
    const limiter = new InMemoryRateLimiter({ limit: 2, windowSeconds: 60 });

    await limiter.limit('key-a');
    await limiter.limit('key-a');
    const blocked = await limiter.limit('key-a');

    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it('resets the count once the window elapses', async () => {
    const limiter = new InMemoryRateLimiter({ limit: 1, windowSeconds: 60 });

    await limiter.limit('key-a');
    const blocked = await limiter.limit('key-a');
    expect(blocked.success).toBe(false);

    vi.setSystemTime(61_000);
    const afterReset = await limiter.limit('key-a');

    expect(afterReset.success).toBe(true);
  });

  it('tracks independent keys without interference', async () => {
    const limiter = new InMemoryRateLimiter({ limit: 1, windowSeconds: 60 });

    const a1 = await limiter.limit('key-a');
    const b1 = await limiter.limit('key-b');
    const a2 = await limiter.limit('key-a');

    expect(a1.success).toBe(true);
    expect(b1.success).toBe(true);
    expect(a2.success).toBe(false);
  });
});

describe('getRateLimiter', () => {
  it('returns the same instance for the same config', () => {
    expect(getRateLimiter({ limit: 5, windowSeconds: 60 })).toBe(
      getRateLimiter({ limit: 5, windowSeconds: 60 }),
    );
  });

  it('returns distinct instances for distinct configs', () => {
    expect(getRateLimiter({ limit: 5, windowSeconds: 60 })).not.toBe(
      getRateLimiter({ limit: 30, windowSeconds: 60 }),
    );
  });
});
