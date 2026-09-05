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

const trustedOrigins = [env.BETTER_AUTH_URL, publicEnv.appUrl].filter((value): value is string =>
  Boolean(value),
);

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
  },
  advanced: {
    cookiePrefix: 'culprit',
  },
});

export type Auth = typeof auth;
