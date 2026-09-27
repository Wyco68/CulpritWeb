---
status: current
source_of_truth: true
last_updated: 2026-09-27
related_modules: [shared, events, research-groups, teaching, projects, integrations]
related_decisions: [ADR-007, ADR-014, ADR-019]
---

# ADR-021: Free-tier cost budget — measured per page, and what was cut

## Status

Accepted.

## Date

2026-09-27

## Context

The project stays on free tiers deliberately (Vercel Hobby as the intended host, Supabase Free,
Cloudflare Free with R2, Upstash Free). Nobody had measured what one page view or one admin action
actually costs against those allowances. This records the measurement, the fixes it led to, and the
resulting budget, so a later change can be checked against it.

Free allowances used (fetched 2026-09-27):

| Service | Allowance per month |
|---|---|
| Vercel Hobby | 100 GB Fast Data Transfer · 10 GB Fast Origin Transfer · 1M function invocations · 4 h Active CPU · 360 GB-h memory · 5K image transformations · 300K image cache reads · 100K image cache writes |
| Supabase Free | 500 MB database · 5 GB egress (+5 GB cached) · pauses after 1 week without activity |
| Cloudflare R2 | 10 GB-month storage · 1M Class A ops · 10M Class B ops · free egress |

## How it was measured

- **Database per render:** a dev server with Prisma query logging, each route requested twice in
  sequence, SQL counted per request (statements, joins, tables). Admin routes were driven from a
  logged-in browser.
- **Per page view:** a production build, each page loaded in a fresh browser (empty cache), scrolled
  to the bottom, every request recorded with its on-the-wire size. Pre- and post-change builds were
  measured side by side.

## Findings

1. **Public pages cost no database work per view.** Every public page is prerendered with ISR; a
   render costs 0–9 queries and happens only on regeneration or an admin purge.
2. **Viewport link prefetching was the largest per-view cost.** Every `<Link>` scrolled into view
   fetched that page's payload: 5–13 background requests (57–144 KB) per view, clicked or not.
3. **Admin code leaked into public bundles.** Module barrels re-exported admin tables and forms;
   Next ships every client component reachable from a page's imports, so zod and admin UI loaded on
   every public page. `cover-crop.ts` (ADR-019) did the same by holding its zod schema.
4. **Image transformations were effectively uncached.** R2 uploads carried no `Cache-Control`, so
   the optimizer used its 60 s default — a photo in demand was re-transformed about once a minute,
   which on Vercel Hobby can use up the 5K monthly transformations at a few thousand views.
5. **ISR regenerated far more often than content changed.** An hourly safety net everywhere and
   5-minute regeneration of `/events` (to move events from Upcoming to Past) — up to ~24K
   regenerations a month for content edited a few times a month.
6. **The admin Team screen had an N+1**: 37 queries per view for 8 members.

## Decisions

| Change | Effect |
|---|---|
| Public links prefetch on intent (`shared/ui/intent-link.tsx`) | 0 background prefetches per view (was 5–13) |
| Admin UI imported by path, not re-exported from module barrels | zod and admin UI gone from public pages; ~140 KB less JS |
| `cover-crop.ts` split into pure helpers + `cover-crop.schema.ts` | same |
| Query client and toaster moved to the `(admin)` route-group layout | react-query and sonner no longer on public pages |
| Image optimizer: 31-day cache TTL, only the widths the site renders, one quality | transformations ≈ distinct variants per month (~100), not per request |
| Uploads stored with `Cache-Control: public, max-age=31536000, immutable` | same, for new uploads |
| Events split into Upcoming/Past in the browser (`EventTimeline`) | `/events` joins the daily safety net instead of 5-minute regeneration |
| Safety-net ISR raised from 1 h to 1 day (pages and purged API routes) | regenerations ~24K → ~700 a month at most |
| Research and publication edits now also purge `/team/[id]` | profiles no longer relied on the hourly net for credited works |
| `/api/team-members/[id]` gets `generateStaticParams` | was rendered on every request |
| Admin Team screen reads links, CV entries, courses and projects in one query each | 37 → 9 queries |

Rejected: Better Auth's session cookie cache. Server Components cannot set cookies, so the cached
copy is written only at sign-in and expires after its TTL — it saved queries for five minutes after
signing in, at the price of revoked sessions staying valid that long.

## Measured result (first view, empty browser cache, on the wire)

| Page | Before: requests / KB | After: requests / KB |
|---|---|---|
| `/` | 47 / 590 | 19 / 372 |
| `/research` | 45 / 578 | 21 / 388 |
| `/publications` | 46 / 591 | 18 / 375 |
| `/team` | 57 / 668 | 22 / 379 |
| `/team/[id]` | 48 / 616 | 22 / 411 |
| `/events` | 51 / 665 | 27 / 478 |
| `/appointment` (own requests; Calendly excluded) | 44 / 569 | 19 / 374 |

Fonts (177 KB, two woff2 files) are now the largest item; they are the typefaces ADR-018 chose and
are cached for a year after the first visit.

## Budget

Worst case — every view a first visit with an empty cache — per month:

| Allowance | 5K views, before → after | 50K views, before → after |
|---|---|---|
| Vercel Fast Data Transfer (100 GB) | 3.0 → 1.9 GB | 30 → 19 GB |
| Requests served | 242K → 106K | 2.4M → 1.06M |
| Vercel function invocations (1M) | ≤ ~25K → ≤ ~2K | same (regenerations don't scale with views) |
| Vercel Active CPU (4 h) | ≤ ~40 min → ≤ ~2 min | same |
| Vercel image transformations (5K) | up to ~10K (over) → ~100 | up to ~100K (over) → ~100 |
| Vercel image cache reads (300K) | ~10K | ~100K |
| Supabase database (500 MB) | 12 MB today | — |
| Supabase egress (5 GB) | ≤ ~0.7 GB → ≤ ~50 MB | same |
| R2 storage (10 GB) / Class A (1M) / Class B (10M) | < 0.1 GB / tens / ≤ ~10K → ~100 | same |

Admin actions add one Cloudflare purge call and a rate-limit check (Upstash) each — hundreds a
month at most.

## Consequences and follow-ups

- **Supabase pauses a free project after a week without database activity.** Public views never
  touch the database, so a quiet week with no admin activity and no regeneration can pause it; the
  next regeneration then fails and ISR keeps serving the last good page until someone unpauses it.
  Crawlers usually trigger daily regenerations, which keeps it active.
- `R2_PUBLIC_URL` is an `r2.dev` address, which Cloudflare rate-limits and does not cache. A custom
  domain on the zone is free, cached at the edge, and recommended before production.
- A new public page must import services from barrels and client UI by path; a new admin component
  must not be added to a module barrel.
