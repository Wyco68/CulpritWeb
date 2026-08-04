import { config as loadEnv } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

// Next.js convention: .env.local holds local secrets and isn't loaded by plain dotenv/config.
loadEnv({ path: '.env.local' });
loadEnv(); // fall back to .env if present (e.g. in CI/Vercel where vars are injected directly)

// Prisma 7: connection URL config moved out of schema.prisma. This URL is for the CLI (migrate/
// studio) only — the app's runtime PrismaClient uses its own driver adapter over DATABASE_URL
// (see src/modules/shared/lib/prisma.ts). Migrations need DIRECT_URL specifically: Supabase's
// pooled DATABASE_URL runs in pgbouncer transaction mode, which doesn't support the prepared
// statements/DDL sequencing `prisma migrate` needs — DIRECT_URL is the session-mode connection.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DIRECT_URL'),
  },
});
