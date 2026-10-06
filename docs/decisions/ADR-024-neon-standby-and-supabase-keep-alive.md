---
status: current
source_of_truth: true
last_updated: 2026-10-06
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

## Consequences

- The copy is at most about 6 hours behind Supabase. Neon Free keeps 6 hours of restore history
  on top of that.
- **Promotion takes no code change.** To make Neon primary, set `DATABASE_URL` (Neon's pooled
  string) and `DIRECT_URL` (direct) in Vercel and Doppler, then disable the workflow. The
  `standby` schema can stay or be dropped.
- A run that starts after a migration merges but before CI's `migrate` job reaches Supabase fails
  on a schema mismatch. The next run succeeds. Supabase was still read, so the keep-alive still
  worked.
- GitHub disables scheduled workflows on a public repository after 60 days without a commit.
- Costs: about 310 rows a run. Neon wakes for each run and sleeps again after 5 minutes, which is
  about 2.5 of the Free plan's 100 CU-hours a month. Storage is about 12 MB of Neon's 1 GB.
