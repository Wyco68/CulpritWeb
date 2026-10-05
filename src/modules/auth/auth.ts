import { after } from 'next/server';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from '@/modules/shared/lib/prisma';
import { env } from '@/modules/shared/lib/env.server';
import { publicEnv } from '@/modules/shared/lib/env';
import { logger } from '@/modules/shared/lib/logger';
import { getEmailClient, getRateLimiter, isEmailDeliveryConfigured } from '@/modules/integrations';
import { CODE_TTL_MINUTES } from './auth-policy';
import { RESET_REQUEST_RESPONSE_FLOOR_MS, adminAuthSecurityOptions } from './auth-security';
import { createVerificationCodeSender } from './verification-code-sender';

// Better Auth: DB-backed, cookie-identified sessions (httpOnly, secure, sameSite=lax, signed with
// BETTER_AUTH_SECRET) — NOT JWT. Single admin: email/password with public sign-up disabled, an
// optional second factor by emailed 8-digit code, and "forgot password" by emailed 8-digit code
// (ADR-022 — the plugin set and its guards live in ./auth-security.ts).
// NOTE: this is the one sanctioned place besides repositories that touches the Prisma client —
// it only hands the client to Better Auth's adapter (which owns the user/session/account tables);
// no domain query runs here.

// Origins a sign-in may come from. Besides the configured URLs of this deployment:
//  - the production domain, so the one shared Doppler config (whose URLs point at staging) still
//    lets the production site sign in;
//  - the local dev server, outside production builds only — a deployed site never trusts a
//    localhost origin.
const PRODUCTION_ORIGIN = 'https://culprits-mystery.party';
const LOCAL_DEV_ORIGIN = 'http://localhost:3000';

const trustedOrigins = [
  env.BETTER_AUTH_URL,
  publicEnv.appUrl,
  PRODUCTION_ORIGIN,
  process.env.NODE_ENV !== 'production' ? LOCAL_DEV_ORIGIN : undefined,
].filter((value): value is string => Boolean(value));

// The one EmailClient caller. With no transport configured, a code is written to the server log in
// development only; in production it is undelivered and logged as an error (a two-factor send then
// answers 503; a reset request still answers its uniform success).
const codeSender = createVerificationCodeSender({
  emailClient: getEmailClient(),
  emailDeliveryConfigured: isEmailDeliveryConfigured(),
  logCodesWhenUnconfigured: process.env.NODE_ENV !== 'production',
  expiresInMinutes: CODE_TTL_MINUTES,
  logger,
});

// A Turnstile secret without the public site key means the reset page renders no widget, so every
// reset request is refused (MISSING_RESPONSE) with nothing else to say why. Shout at boot instead.
if (env.TURNSTILE_SECRET_KEY && !publicEnv.turnstileSiteKey) {
  logger.error('turnstile_misconfigured', {
    reason:
      'TURNSTILE_SECRET_KEY is set but NEXT_PUBLIC_TURNSTILE_SITE_KEY is empty — password reset requests will all be refused',
  });
}

// The reset-code email is sent after the response (see createPasswordResetOtpSender). Next's
// `after()` keeps it alive on a serverless host (Vercel), where a floating promise would be frozen
// with the function; on the VPS's long-running server it simply runs. Outside a request scope
// (`after()` throws there) the task just floats.
function runInBackground(task: () => Promise<void>): void {
  const run = () => task().catch(() => {});
  try {
    after(run);
  } catch {
    void run();
  }
}

export const auth = betterAuth({
  appName: 'The Culprit',
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL ?? (publicEnv.appUrl || undefined),
  trustedOrigins,
  // Email/password (sign-up disabled), the emailed-code second factor, forgot-password by code,
  // Turnstile on the reset request, and the endpoints switched off — see ./auth-security.ts.
  ...adminAuthSecurityOptions({
    codeSender,
    isEmailDeliveryConfigured,
    runInBackground,
    // Keys the stored-code HMAC. The env schema makes the secret mandatory in production; the
    // fallback only ever applies to a local dev server without one (Better Auth itself falls back
    // to a built-in dev secret in that case too).
    otpHashSecret: env.BETTER_AUTH_SECRET ?? 'culprit-local-dev-only-otp-hash-key',
    // Fail closed in production when Turnstile isn't configured; skip the check in development.
    captcha: {
      secretKey: env.TURNSTILE_SECRET_KEY,
      required: process.env.NODE_ENV === 'production',
    },
    // Site-wide reset budget — the same in-process limiter the middleware uses (ADR-008).
    rateLimiterFor: getRateLimiter,
    responseFloor: {
      ms: RESET_REQUEST_RESPONSE_FLOOR_MS,
      now: () => performance.now(),
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    },
  }),
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh daily (rolling)
  },
  advanced: {
    cookiePrefix: 'culprit',
    // DO NOT set `backgroundTasks` here. With a background handler Better Auth stops awaiting
    // `sendOTP`, so a failed two-factor email can no longer be reported as 503
    // EMAIL_DELIVERY_FAILED (see auth-security.ts) — the admin would be told a code was sent when
    // it wasn't. The password-reset send is already fire-and-forget on its own, for timing.
  },
});

export type Auth = typeof auth;
