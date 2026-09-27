import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from '@/modules/shared/lib/prisma';
import { env } from '@/modules/shared/lib/env.server';
import { publicEnv } from '@/modules/shared/lib/env';

// Better Auth: DB-backed, cookie-identified sessions (httpOnly, secure, sameSite=lax, signed with
// BETTER_AUTH_SECRET) — NOT JWT. Single admin: email/password with public sign-up disabled.
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

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL ?? (publicEnv.appUrl || undefined),
  trustedOrigins,
  emailAndPassword: {
    enabled: true,
    // Single admin only — no public registration. The credential is seeded from env, never a form.
    disableSignUp: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh daily (rolling)
    // Every admin page and write checks the session, which cost two queries (session, then user)
    // per request. The cookie cache keeps a signed copy of the session in a second cookie and
    // trusts it for 5 minutes, so most admin requests reach no table at all for auth. The trade:
    // a session revoked from ANOTHER device stays usable for up to 5 minutes. Signing out on this
    // device clears the cookie immediately. Acceptable for the single admin account.
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  advanced: {
    cookiePrefix: 'culprit',
  },
});

export type Auth = typeof auth;
