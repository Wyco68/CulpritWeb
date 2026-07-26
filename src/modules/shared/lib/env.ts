import { z } from 'zod';

// Server-only env, validated once. Import from server code (services/repositories/route handlers).
// Fail fast: a missing secret should crash boot, not surface as a runtime 500 later.
const serverSchema = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),
  BETTER_AUTH_SECRET: z.string().min(1).optional(),
  BETTER_AUTH_URL: z.string().url().optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(1).optional(),
  TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  STORAGE_DRIVER: z.enum(['r2', 'supabase']).default('r2'),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  R2_PUBLIC_BASE_URL: z.string().url().optional(),
});

// Optional-heavy during scaffold; tighten (.min(1) → required) as each module lands.
export const env = serverSchema.parse(process.env);

// Client-safe values (only NEXT_PUBLIC_* ever reach the browser).
export const publicEnv = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? '',
  turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '',
  calendlyUrl: process.env.NEXT_PUBLIC_CALENDLY_URL ?? '',
};
