import { NextResponse, type NextRequest } from 'next/server';
import { getRateLimiter } from '@/modules/integrations/rate-limit/rate-limiter';

// Edge Middleware: application-level rate-limit fallback behind the Cloudflare edge WAF rule
// (ADR-008), which is the primary control for auth sign-in. Scoped by `matcher` below to exactly
// the two route groups that need it — never runs on the ISR-cached public GET routes.

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export type RateLimitRule = { key: string; limit: number; windowSeconds: number };

/** Pure decision function (no NextRequest coupling) so it's unit-testable in isolation. */
export function resolveRateLimitRule(
  pathname: string,
  method: string,
  ip: string,
): RateLimitRule | null {
  if (pathname === '/api/auth/sign-in/email' && method === 'POST') {
    return { key: `auth-signin:${ip}`, limit: 5, windowSeconds: 60 };
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

/**
 * Old `/api/team-members?groupId=X` callers (pre-ADR-007-addendum contract) still land on the
 * unfiltered route, since Next doesn't route on query string. Redirect here, in middleware, rather
 * than in the route handler: reading `request.nextUrl.searchParams` inside a route handler is
 * itself a dynamic-API use that forces the whole route dynamic (confirmed via `next build`'s
 * "Dynamic server usage" error — the route handler previously did this and silently lost its
 * `export const revalidate = 3600` caching as a result). Middleware runs before route-level static
 * analysis and isn't subject to that rule, so the redirect can live here for free.
 */
export function resolveTeamMembersCompatRedirect(request: NextRequest): NextResponse | null {
  if (request.nextUrl.pathname !== '/api/team-members' || request.method !== 'GET') return null;
  const groupId = request.nextUrl.searchParams.get('groupId');
  if (!groupId) return null;
  return NextResponse.redirect(
    new URL(`/api/team-members/group/${encodeURIComponent(groupId)}`, request.url),
    307,
  );
}

const PRIVATE_NO_STORE = 'private, no-store';

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const redirect = resolveTeamMembersCompatRedirect(request);
  if (redirect) return redirect;

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
  matcher: ['/api/auth/:path*', '/api/admin/:path*', '/api/team-members'],
};
