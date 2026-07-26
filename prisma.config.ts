import { config as loadEnv } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

// Next.js convention: .env.local holds local secrets and isn't loaded by plain dotenv/config.
loadEnv({ path: '.env.local' });
loadEnv(); // fall back to .env if present (e.g. in CI/Vercel where vars are injected directly)

// Prisma 7: connection URL config moved out of schema.prisma. Migrations run through
// this URL directly (driver-adapter migrations don't need a separate directUrl).
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
});
