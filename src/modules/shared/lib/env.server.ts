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
  // Supabase Storage — server-only service-role client. All uploads/deletes/signed-URL issuance
  // happen through this key (bypasses RLS); the public buckets are readable via plain HTTPS URLs
  // without any key, so no client-facing Supabase env is needed.
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  // Calendly REST integration (Personal Access Token, single professor account). All optional so
  // dev/test boots unconfigured; when unset the integration reports "not configured" and never crashes.
  CALENDLY_ACCESS_TOKEN: z.string().min(1).optional(),
  CALENDLY_USER_URI: z.string().url().optional(),
  CALENDLY_WEBHOOK_SIGNING_KEY: z.string().min(1).optional(),
});

// dotenv loads an unset-but-present `KEY=` line as `""`, not `undefined` — Zod's `.optional()`
// only skips validation for `undefined`, so a blank optional secret (e.g. a not-yet-configured
// Calendly/Resend/Turnstile key) would otherwise fail `.min(1)`/`.url()` and crash boot. Treat
// blank env values as unset before validating.
const rawEnv = Object.fromEntries(
  Object.entries(process.env).map(([key, value]) => [key, value === '' ? undefined : value]),
);

export const env = serverSchema.parse(rawEnv);
