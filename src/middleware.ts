import { NextResponse, type NextRequest } from 'next/server';
import { getRateLimiter } from '@/modules/integrations/rate-limit/rate-limiter';

// Edge Middleware: application-level rate-limit fallback behind the Cloudflare edge WAF rule
// (ADR-008), which is the primary control for auth sign-in. Scoped by `matcher` below to exactly
// the two route groups that need it — never runs on the ISR-cached public GET routes.

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export type RateLimitRule = { key: string; limit: number; windowSeconds: number };

const TEN_MINUTES = 10 * 60;

// Emailed-code endpoints (ADR-022, ADR-023), per IP. Paths that share a bucket share a budget: the
// two ways to answer a sign-in challenge can't be alternated to double the guesses.
//  - a reset request emails the admin on a stranger's say-so: 3 per 10 minutes;
//  - a 2FA send: 5 per 10 minutes. It already needs the password (a pending challenge), so it isn't
//    an anonymous flood vector; room for a sign-in plus a resend or two;
//  - checking a code: 10 per 10 minutes, on top of the plugins' own per-code attempt limits;
//  - replacing the backup codes (password-checked): 10 per 10 minutes.
const AUTH_CODE_RULES = new Map<string, { bucket: string; limit: number }>([
  ['/api/auth/two-factor/send-otp', { bucket: 'auth-2fa-send', limit: 5 }],
  ['/api/auth/email-otp/request-password-reset', { bucket: 'auth-reset-request', limit: 3 }],
  ['/api/auth/two-factor/verify-otp', { bucket: 'auth-2fa-verify', limit: 10 }],
  ['/api/auth/two-factor/verify-backup-code', { bucket: 'auth-2fa-verify', limit: 10 }],
  ['/api/auth/email-otp/reset-password', { bucket: 'auth-reset', limit: 10 }],
  ['/api/auth/two-factor/generate-backup-codes', { bucket: 'auth-2fa-settings', limit: 10 }],
]);

// Site-wide (all-IP) budgets for reset requests are NOT here: they live in a Better Auth hook
// (auth-security.ts) that runs after Turnstile, so a request without a valid token can't spend them.

/** Pure decision function (no NextRequest coupling) so it's unit-testable in isolation. */
export function resolveRateLimitRule(
  rawPathname: string,
  method: string,
  ip: string,
): RateLimitRule | null {
  // One normalisation for every rule, so a trailing slash can't be used to step around a limit.
  const pathname = rawPathname.replace(/\/+$/, '') || '/';

  if (pathname === '/api/auth/sign-in/email' && method === 'POST') {
    return { key: `auth-signin:${ip}`, limit: 5, windowSeconds: 60 };
  }
  const authCodeRule = method === 'POST' ? AUTH_CODE_RULES.get(pathname) : undefined;
  if (authCodeRule) {
    return {
      key: `${authCodeRule.bucket}:${ip}`,
      limit: authCodeRule.limit,
      windowSeconds: TEN_MINUTES,
    };
  }
  if (pathname.startsWith('/api/admin/') && MUTATING_METHODS.has(method)) {
    return { key: `admin:${ip}:${pathname}`, limit: 30, windowSeconds: 60 };
  }
  return null;
}

// Local re-implementation of shared/lib/request.ts#getClientIp: that module imports `node:crypto`
// (for hashIp), which Edge Middleware can't bundle. Same proxy-header logic, Edge-safe.
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();
  return headers.get('x-real-ip')?.trim() ?? 'unknown';
}

/** 429 shaped like the shared API error envelope (see shared/lib/api-response.ts#apiError). */
export function rateLimitExceededResponse(retryAfterSeconds: number): NextResponse {
  return NextResponse.json(
    {
      ok: false,
      error: { code: 'rate_limited', message: 'Too many requests. Please try again later.' },
    },
    { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } },
  );
}

const PRIVATE_NO_STORE = 'private, no-store';

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const isPrivateSurface = pathname.startsWith('/api/auth/') || pathname.startsWith('/api/admin/');

  const ip = getClientIp(request.headers);
  const rule = resolveRateLimitRule(pathname, request.method, ip);
  if (rule) {
    const limiter = getRateLimiter({ limit: rule.limit, windowSeconds: rule.windowSeconds });
    const { success, reset } = await limiter.limit(rule.key);
    if (!success) {
      const retryAfter = Math.max(0, Math.ceil((reset - Date.now()) / 1000));
      const response = rateLimitExceededResponse(retryAfter);
      if (isPrivateSurface) response.headers.set('Cache-Control', PRIVATE_NO_STORE);
      return response;
    }
  }

  const response = NextResponse.next();
  // Defense-in-depth: explicitly forbid shared/browser caching of session-gated surfaces, rather
  // than relying only on the absence of a Cache-Control header (which a misconfigured proxy or a
  // future Cloudflare Cache Rule could still choose to cache). Public GET routes are unaffected —
  // this matcher never runs on them.
  if (isPrivateSurface) response.headers.set('Cache-Control', PRIVATE_NO_STORE);
  return response;
}

export const config = {
  matcher: ['/api/auth/:path*', '/api/admin/:path*'],
};
