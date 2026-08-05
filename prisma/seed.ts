import { config as loadEnv } from 'dotenv';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from '../src/modules/shared/lib/prisma';

// Provisions the single admin account from ADMIN_EMAIL/ADMIN_INITIAL_PASSWORD (PROJECT_SPEC
// §5.3/FR-13, CLAUDE.md: "Better Auth secure cookie sessions, single admin"). The app's own
// `auth` instance (src/modules/auth/auth.ts) has `disableSignUp: true` — sign-up is deliberately
// unreachable from any route. This script builds a throwaway instance with sign-up enabled,
// purely to call Better Auth's own password-hashing/account-creation path instead of
// hand-rolling one, then never touches it again. Idempotent: does nothing if the email already
// has an account.

loadEnv({ path: '.env.local' });
loadEnv();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_INITIAL_PASSWORD;

  if (!email || !password) {
    console.log('ADMIN_EMAIL / ADMIN_INITIAL_PASSWORD not set — skipping admin seed.');
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin account for ${email} already exists — skipping.`);
    return;
  }

  const seedAuth = betterAuth({
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    secret: process.env.BETTER_AUTH_SECRET,
    emailAndPassword: { enabled: true, disableSignUp: false },
  });

  await seedAuth.api.signUpEmail({
    body: { email, password, name: 'Admin' },
  });

  console.log(`Admin account created for ${email}.`);
}

main()
  .catch((error) => {
    console.error('Admin seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
