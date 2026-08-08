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
  // Cloudflare R2 — S3-compatible object storage (adopted 2026-08-08 over Supabase Storage; see
  // PROJECT_SPEC.md §14.1/§7 — R2 never charges for egress, which was the binding bottleneck).
  // The database has no dependency on these; DATABASE_URL/Prisma talk to Postgres directly.
  R2_ACCOUNT_ID: z.string().min(1).optional(),
  R2_ACCESS_KEY_ID: z.string().min(1).optional(),
  R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  R2_BUCKET_NAME: z.string().min(1).optional(),
  /** Public base URL for the bucket — a custom domain, or the `pub-<hash>.r2.dev` dev URL. */
  R2_PUBLIC_URL: z.string().url().optional(),
  // No CALENDLY_* server vars: the app has no server-side Calendly integration at all (embed
  // only — see modules/integrations). The public scheduling link is NEXT_PUBLIC_CALENDLY_URL.
});

// dotenv loads an unset-but-present `KEY=` line as `""`, not `undefined` — Zod's `.optional()`
// only skips validation for `undefined`, so a blank optional secret (e.g. a not-yet-configured
// Resend/Turnstile key) would otherwise fail `.min(1)`/`.url()` and crash boot. Treat blank env
// values as unset before validating.
const rawEnv = Object.fromEntries(
  Object.entries(process.env).map(([key, value]) => [key, value === '' ? undefined : value]),
);

export const env = serverSchema.parse(rawEnv);
