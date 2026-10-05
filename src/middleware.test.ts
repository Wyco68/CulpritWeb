import { describe, expect, it } from 'vitest';
import { getClientIp, rateLimitExceededResponse, resolveRateLimitRule } from './middleware';

// Pure-logic coverage only — the `middleware` export itself is a thin NextRequest/NextResponse
// wrapper around these functions plus the shared rate limiter, not worth fighting the Next.js
// Edge Middleware test harness for.

describe('resolveRateLimitRule', () => {
  const TEN_MINUTES = 600;
  const key = (pathname: string, method = 'POST', ip = '1.2.3.4') =>
    resolveRateLimitRule(pathname, method, ip)?.key;

  it('applies the auth sign-in rule to POST /api/auth/sign-in/email', () => {
    expect(resolveRateLimitRule('/api/auth/sign-in/email', 'POST', '1.2.3.4')).toEqual({
      key: 'auth-signin:1.2.3.4',
      limit: 5,
      windowSeconds: 60,
    });
  });

  it('normalises a trailing slash for every rule, sign-in included', () => {
    expect(resolveRateLimitRule('/api/auth/sign-in/email/', 'POST', '1.2.3.4')).toEqual(
      resolveRateLimitRule('/api/auth/sign-in/email', 'POST', '1.2.3.4'),
    );
    expect(resolveRateLimitRule('/api/auth/two-factor/send-otp//', 'POST', '1.2.3.4')).toEqual(
      resolveRateLimitRule('/api/auth/two-factor/send-otp', 'POST', '1.2.3.4'),
    );
    expect(key('/api/admin/research/', 'POST', '5.6.7.8')).toBe(
      'admin:5.6.7.8:/api/admin/research',
    );
  });

  it('does not rate-limit other auth routes (e.g. sign-out, session)', () => {
    expect(resolveRateLimitRule('/api/auth/sign-out', 'POST', '1.2.3.4')).toBeNull();
    expect(resolveRateLimitRule('/api/auth/get-session', 'GET', '1.2.3.4')).toBeNull();
  });

  it('does not rate-limit a GET to the sign-in path', () => {
    expect(resolveRateLimitRule('/api/auth/sign-in/email', 'GET', '1.2.3.4')).toBeNull();
  });

  describe('emailed-code endpoints (ADR-022)', () => {
    it('allows 3 reset requests and 5 two-factor sends per 10 minutes per IP', () => {
      expect(resolveRateLimitRule('/api/auth/two-factor/send-otp', 'POST', '1.2.3.4')).toEqual({
        key: 'auth-2fa-send:1.2.3.4',
        limit: 5,
        windowSeconds: TEN_MINUTES,
      });
      expect(
        resolveRateLimitRule('/api/auth/email-otp/request-password-reset', 'POST', '1.2.3.4'),
      ).toEqual({ key: 'auth-reset-request:1.2.3.4', limit: 3, windowSeconds: TEN_MINUTES });
    });

    it('keeps the site-wide reset budget out of middleware (it runs after Turnstile instead)', () => {
      expect(key('/api/auth/email-otp/request-password-reset')).not.toMatch(/global/);
    });

    it('allows 10 code checks per 10 minutes per IP', () => {
      expect(resolveRateLimitRule('/api/auth/two-factor/verify-otp', 'POST', '1.2.3.4')).toEqual({
        key: 'auth-2fa-verify:1.2.3.4',
        limit: 10,
        windowSeconds: TEN_MINUTES,
      });
      expect(resolveRateLimitRule('/api/auth/email-otp/reset-password', 'POST', '1.2.3.4')).toEqual(
        { key: 'auth-reset:1.2.3.4', limit: 10, windowSeconds: TEN_MINUTES },
      );
    });

    it('shares one budget between the sign-in code and a backup code', () => {
      expect(key('/api/auth/two-factor/verify-backup-code')).toBe(
        key('/api/auth/two-factor/verify-otp'),
      );
    });

    it('limits replacing the backup codes, and no longer rate-limits the disabled enable/disable', () => {
      expect(key('/api/auth/two-factor/generate-backup-codes')).toBe('auth-2fa-settings:1.2.3.4');
      // 404 since ADR-023 — Better Auth refuses them before any work is done.
      expect(resolveRateLimitRule('/api/auth/two-factor/enable', 'POST', '1.2.3.4')).toBeNull();
      expect(resolveRateLimitRule('/api/auth/two-factor/disable', 'POST', '1.2.3.4')).toBeNull();
    });

    it('keys every rule by IP', () => {
      expect(key('/api/auth/two-factor/send-otp', 'POST', '1.1.1.1')).not.toBe(
        key('/api/auth/two-factor/send-otp', 'POST', '2.2.2.2'),
      );
    });

    it('only limits POST', () => {
      expect(resolveRateLimitRule('/api/auth/two-factor/send-otp', 'GET', '1.2.3.4')).toBeNull();
    });
  });

  it('applies the admin rule to mutating methods under /api/admin/**', () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      expect(resolveRateLimitRule('/api/admin/research', method, '5.6.7.8')).toEqual({
        key: 'admin:5.6.7.8:/api/admin/research',
        limit: 30,
        windowSeconds: 60,
      });
    }
  });

  it('does not rate-limit GET requests under /api/admin/**', () => {
    expect(resolveRateLimitRule('/api/admin/research', 'GET', '5.6.7.8')).toBeNull();
  });

  it('keys the admin rule by pathname so different admin routes track independently', () => {
    expect(key('/api/admin/research', 'POST', '5.6.7.8')).not.toBe(
      key('/api/admin/publications', 'POST', '5.6.7.8'),
    );
  });

  it('ignores unrelated public routes', () => {
    expect(resolveRateLimitRule('/api/research', 'GET', '1.2.3.4')).toBeNull();
    expect(resolveRateLimitRule('/api/turnstile/verify', 'POST', '1.2.3.4')).toBeNull();
  });
});

describe('getClientIp', () => {
  it('reads the first entry of x-forwarded-for', () => {
    const headers = new Headers({ 'x-forwarded-for': '9.9.9.9, 1.1.1.1' });
    expect(getClientIp(headers)).toBe('9.9.9.9');
  });

  it('falls back to x-real-ip', () => {
    const headers = new Headers({ 'x-real-ip': '8.8.8.8' });
    expect(getClientIp(headers)).toBe('8.8.8.8');
  });

  it('falls back to "unknown" when neither header is present', () => {
    expect(getClientIp(new Headers())).toBe('unknown');
  });
});

describe('rateLimitExceededResponse', () => {
  it('returns a 429 with the standard error envelope and Retry-After header', async () => {
    const response = rateLimitExceededResponse(42);

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('42');
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: { code: 'rate_limited', message: 'Too many requests. Please try again later.' },
    });
  });
});
