---
status: current
source_of_truth: false
last_updated: 2026-08-08
related_modules: [shared]
related_decisions: []
---

# Local development

## Setup

1. `npm install`.
2. Copy `.env.example` to `.env.local` and fill in real values (never commit `.env.local` — it's
   gitignored). Only `DATABASE_URL` is strictly required to boot; everything else has a graceful
   no-op fallback (see below).
3. `npm run db:migrate` — applies migrations to your dev database (`prisma migrate dev`).
4. `npm run db:seed` — provisions the single admin from `ADMIN_EMAIL`/`ADMIN_INITIAL_PASSWORD`.
   `npm run db:seed:demo` additionally seeds demo public content.
5. `npm run dev` — runs `prisma migrate deploy` first (`predev` script), then `next dev`.

## Environment variables

Grouped by concern in `.env.example` (the committed template — no secrets):

| Group | Vars | Required? |
|---|---|---|
| App | `NEXT_PUBLIC_APP_URL` | Recommended |
| Database | `DATABASE_URL` (pooled), `DIRECT_URL` (direct, for migrations) | `DATABASE_URL` required |
| Auth | `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `ADMIN_EMAIL`, `ADMIN_INITIAL_PASSWORD` | Secret required in production (≥32 chars); optional in dev |
| Email | `RESEND_API_KEY`, `EMAIL_FROM` | Optional — unused for appointments |
| Bot defense | `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Optional — no-ops (always passes) when unset |
| Rate limiting | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Optional — no-op (always allows) when unset |
| Storage | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` | Optional — no-op (logs + returns an error Result) when unset |
| Calendly | `NEXT_PUBLIC_CALENDLY_URL` | Optional — embed shows a graceful empty state when unset |

Validated once at boot by `src/modules/shared/lib/env.server.ts` (server secrets) and
`src/modules/shared/lib/env.ts` (the `NEXT_PUBLIC_*` subset safe for client code). A required var
missing in production crashes boot rather than surfacing as a runtime 500 later.

**No `STORAGE_DRIVER` toggle and no `SUPABASE_*`/`CALENDLY_ACCESS_TOKEN` server vars exist in the
current schema** — those belonged to removed integrations (see
[ADR-002](../decisions/ADR-002-object-storage-r2.md),
[ADR-005](../decisions/ADR-005-calendly-embed-only.md)). If your local `.env.local` still has
leftover values for those keys from an earlier checkout, they're inert — the app never reads them
— but there's no reason to keep unused live credentials lying around; remove or rotate them.

## Every integration has a no-op fallback

Turnstile, the rate limiter, and object storage all boot cleanly with unset env — they log a
warning and either always-pass (Turnstile/rate-limit) or return a typed `IntegrationError`
(storage), so local dev never needs every third-party account configured just to run the app.

## Useful scripts

```bash
npm run db:generate   # prisma generate
npm run db:migrate    # prisma migrate dev (dev only — never in prod)
npm run db:deploy     # prisma migrate deploy (CI/CD)
npm run format         # prettier --write .
npm run docs:search -- "<query>"   # search the docs/ knowledge base — see docs/README.md
```
