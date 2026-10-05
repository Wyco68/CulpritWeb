import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from '@/modules/shared/lib/prisma';
import { env } from '@/modules/shared/lib/env.server';
import { publicEnv } from '@/modules/shared/lib/env';
import { logger } from '@/modules/shared/lib/logger';
import { getEmailClient, getRateLimiter, isEmailDeliveryConfigured } from '@/modules/integrations';
import { CODE_TTL_MINUTES } from './auth-policy';
import { adminAuthSecurityOptions } from './auth-security';
import { createVerificationCodeSender } from './verification-code-sender';

// Better Auth: DB-backed, cookie-identified sessions (httpOnly, secure, sameSite=lax, signed with
// BETTER_AUTH_SECRET) — NOT JWT. Single admin: email/password with public sign-up disabled, a
// MANDATORY second factor by 8-digit code emailed to the fixed admin address, and "forgot password"
// by emailed 8-digit code (ADR-022, ADR-023 — the plugin set and its guards live in
// ./auth-security.ts).
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

// The one EmailClient caller; every code goes to ADMIN_EMAIL. With no transport configured, a code
// is written to the server log in development only; in production it is undelivered, logged as an
// error, and the request answers 503 EMAIL_DELIVERY_FAILED.
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

// Two-step verification is mandatory (ADR-023), so a production server that can't send email can't
// sign the admin in at all — only a backup code still works. Shout at boot rather than at sign-in.
if (process.env.NODE_ENV === 'production' && !isEmailDeliveryConfigured()) {
  logger.error('email_delivery_unconfigured', {
    reason:
      'RESEND_API_KEY / EMAIL_FROM are not set — admin sign-in codes and reset codes cannot be sent',
  });
}

export const auth = betterAuth({
  appName: 'The Culprit',
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL ?? (publicEnv.appUrl || undefined),
  trustedOrigins,
  // Email/password (sign-up disabled), the mandatory emailed-code second factor, forgot-password by
  // code, Turnstile on the reset request, and the endpoints switched off — see ./auth-security.ts.
  ...adminAuthSecurityOptions({
    codeSender,
    logger,
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
  }),
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh daily (rolling)
  },
  advanced: {
    cookiePrefix: 'culprit',
    // DO NOT set `backgroundTasks` here. With a background handler Better Auth stops awaiting the
    // code sends, so a failed email (two-factor or reset) can no longer be reported as 503
    // EMAIL_DELIVERY_FAILED (see auth-security.ts) — the admin would be told a code was sent when
    // it wasn't.
  },
});

export type Auth = typeof auth;
