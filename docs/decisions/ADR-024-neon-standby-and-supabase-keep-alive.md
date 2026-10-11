---
status: current
source_of_truth: true
last_updated: 2026-10-11
related_modules: [shared]
related_decisions: [ADR-001, ADR-013, ADR-021]
---

# ADR-024: Supabase stays primary; a scheduled job mirrors it into a Neon standby

## Status

Accepted. Extends [ADR-001](ADR-001-database.md): the app's database is unchanged.

## Date

2026-10-06

## Context

Supabase pauses a Free project after a week without database activity (ADR-021). Public pages are
prerendered and never query the database, so a quiet week can pause it, and only someone logging
in to the Supabase dashboard can bring it back. The Free plan also has no backups.

Two alternatives were rejected:

- **Moving the app to Cloudflare D1** (which never pauses). Vercel production is not a Worker, so
  it could reach D1 only through Cloudflare's REST API: one HTTPS round trip per query, under an
  account-wide limit of 1,200 requests per 5 minutes. Worse, Prisma's D1 adapter silently drops
  transactions, which breaks the rule that a mutation and its `AuditLog` row commit together.
- **Mirroring into D1.** This works, but the copy has to be converted to SQLite (list columns
  become JSON, with a separately generated schema). A D1 copy could not be promoted without porting
  the app.

Neon is Postgres. A Neon copy is built from the same Prisma migrations and read by the same code.

## Decision

Supabase stays the only database the app reads or writes. `.github/workflows/neon-sync.yml` runs
`scripts/sync-supabase-to-neon.ts` every 6 hours. The script:

- reads every table from Supabase in one read-only snapshot, which counts as the database activity
  that stops the pause;
- runs `prisma migrate deploy` against Neon, so the standby's schema follows the repo;
- replaces Neon's rows in a single transaction (truncate, insert, count check, commit). A failed
  run rolls back, so Neon keeps its previous copy and is never half-written;
- runs only against a Neon database it marked itself (the `standby` schema), and never against a
  URL that matches the source.

A second keep-alive is independent of GitHub. Vercel Cron (`vercel.json`) calls
`/api/cron/keep-alive` on production once a day. The route reads the lab profile and returns
nothing from it. It only answers Vercel's `Authorization: Bearer $CRON_SECRET` header, and refuses
every request where `CRON_SECRET` is unset. GitHub disables a public repository's scheduled
workflows after 60 days without a commit. The usual workaround, re-enabling the workflow from
inside itself, was not used: the best-known tool for it has been disabled by GitHub for breaking
its terms of service. If that ever happens, the Neon copy goes stale, but Supabase still gets a
daily read.

## Consequences

- The copy is at most about 6 hours behind Supabase. Neon Free keeps 6 hours of restore history
  on top of that.
- **Promotion takes no code change.** To make Neon primary, set `DATABASE_URL` (Neon's pooled
  string) and `DIRECT_URL` (direct) in Vercel and Doppler, then disable the workflow. The
  `standby` schema can stay or be dropped.
- A run that starts after a migration merges but before CI's `migrate` job reaches Supabase
  skips the copy. It sees the migration in the checkout that Supabase hasn't applied yet. The next
  run catches up. Supabase was still read, so the keep-alive still worked.
- If GitHub disables the sync after 60 quiet days, re-enable it from the Actions tab. The Vercel
  cron keeps Supabase awake in the meantime.
- `CRON_SECRET` is set by hand in Vercel's production environment. Cron jobs only run on a
  production deployment, so the keep-alive starts with the first manual deploy after the merge.
- Vercel functions run in `bom1` (Mumbai, `regions` in `vercel.json`), the same region as
  Supabase (`ap-south-1`). Before 2026-10-11 they ran in Vercel's default `iad1` (Washington), so
  every query crossed the world. A manual run of the cron took 1.62 s there. Hobby allows choosing
  one region.
- Vercel cost: Hobby allows only daily crons. That is about 30 calls a month, each a single read
  capped at 10 seconds (`maxDuration`), out of the plan's included function usage.
- Costs: about 310 rows a run. Neon wakes for each run and sleeps again after 5 minutes, which is
  about 2.5 of the Free plan's 100 CU-hours a month. Storage is about 12 MB of Neon's 1 GB.
