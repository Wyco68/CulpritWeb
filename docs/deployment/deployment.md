---
status: current
source_of_truth: false
last_updated: 2026-08-08
related_modules: [shared, integrations]
related_decisions: [ADR-001, ADR-002]
---

# Deployment

## Platform

**Vercel** — `NEXT_PUBLIC_APP_URL`/`BETTER_AUTH_URL` are set to the deployed URL. Not
stack-agnostic anymore in practice; see [architecture/overview.md](../architecture/overview.md)
for the full adopted stack.

A self-hosted alternative also exists — one prebuilt Docker container on a low-resource VPS,
built and pushed by CI, never built on the VPS itself. See
[docker-vps.md](docker-vps.md) for that pipeline; everything below (build command, migrations,
connection pooling) applies identically to both targets.

## Build

```bash
npm run build   # prisma generate && next build
```

`npm run predev` (`prisma migrate deploy`) only runs before `next dev`, not before `build` — CI/CD
must run `prisma migrate deploy` as an explicit release step, separate from the build command.

## Migrations

- **Never** run `prisma migrate dev` against production.
- Release step: `npm run db:deploy` (`prisma migrate deploy`), using `DIRECT_URL` (unpooled) —
  matches `.env.example`'s split between the pooled `DATABASE_URL` (app queries) and `DIRECT_URL`
  (migrations, prepared statements).

## Connection pooling

Serverless + Postgres exhausts connections fast. The app uses Supabase's pooled connection
(port 6543, pgbouncer, transaction mode) for `DATABASE_URL`; migrations use the direct connection
(port 5432) via `DIRECT_URL`. This is mandatory, not optional, in a serverless deploy.

## Object storage & DNS

`R2_PUBLIC_URL` points at the bucket's `pub-<hash>.r2.dev` dev URL, not a custom domain — see
[ADR-002](../decisions/ADR-002-object-storage-r2.md) for why (the project's own domain's DNS zone
lives in a different Cloudflare account than the R2 bucket).

## Security headers & HTTPS

HTTPS everywhere; Better Auth cookies require `secure` in production. The Calendly embed needs its
origin allowlisted in `frame-src`/CSP if a Content-Security-Policy header is added.

## Backups

**Open question — not yet decided.** Supabase's free tier has no automatic backups (surfaced by
the `HOSTING_COST.html` review). Accept the risk, script a manual backup, or budget for a paid
tier with backups included — see `requirements/scope.md`'s open questions.

## Observability

Structured logs (`shared/lib/logger.ts`) plus the `AuditLog` table for domain-level audit of admin
actions and appointment transitions. No dedicated uptime/error-monitoring integration is present
in the codebase today — target is 99.5% uptime per the non-functional requirements, but no
monitoring tool is wired up to measure it.

## Cost constraint

Every third-party service must stay on its **free tier**: Vercel (hobby), Supabase (free Postgres),
Cloudflare R2 (free egress), Calendly (free, embed-only), Cloudflare Turnstile (free), Cloudflare
WAF Rate Limiting + DNS proxy (Free plan, 1 rate limiting rule per zone), Resend (free tier,
unused). See `HOSTING_COST.html` for the full cost review that drove the R2 migration
([ADR-002](../decisions/ADR-002-object-storage-r2.md)) and
[ADR-008](../decisions/ADR-008-cloudflare-rate-limiting.md) for the rate-limiting architecture.
