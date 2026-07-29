import 'server-only';
import { z } from 'zod';

// SERVER-ONLY env, validated once at first import. The `server-only` guard makes any accidental
// client import a build error, so `process.env` secrets (DB URL, auth secret, API keys) can never
// be parsed in the browser bundle. Consumed by services, repositories, route handlers, and auth.
// Fail fast: a missing/weak secret should crash boot, not surface as a runtime 500 later.

// BETTER_AUTH_SECRET signs the session cookies. It MUST exist in production (an unsigned/derived
// secret silently weakens sessions); relaxed to optional only in dev/test for zero-config startup.
const authSecretSchema =
  process.env.NODE_ENV === 'production'
    ? z.string().min(32, 'BETTER_AUTH_SECRET must be at least 32 characters in production.')
    : z.string().min(32).optional();

const serverSchema = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),
  BETTER_AUTH_SECRET: authSecretSchema,
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
  // Calendly REST integration (Personal Access Token, single professor account). All optional so
  // dev/test boots unconfigured; when unset the integration reports "not configured" and never crashes.
  CALENDLY_ACCESS_TOKEN: z.string().min(1).optional(),
  CALENDLY_USER_URI: z.string().url().optional(),
  CALENDLY_WEBHOOK_SIGNING_KEY: z.string().min(1).optional(),
});

export const env = serverSchema.parse(process.env);
