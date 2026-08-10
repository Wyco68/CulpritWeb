---
status: current
source_of_truth: true
last_updated: 2026-08-10
related_modules: [shared]
related_decisions: [ADR-006]
---

# ADR-007: Fix stale cache-invalidation paths; extend on-demand caching to public GET API routes

## Status

Accepted

## Date

2026-08-10

## Context

`src/modules/shared/lib/revalidate.ts` invalidates the public pages an admin mutation affects via
`revalidatePath()`, keyed by a `PublicArea` (`research`, `publications`, `team`, `events`,
`appointment`, plus a `'profile'` special case for the site header in the public layout).

An audit found `AREA_PATHS` still used route-template paths from before ADR-006
(`'/[locale]/research'`, etc.) and the `'profile'` case called
`revalidatePath('/[locale]', 'layout')`. Locale routing was removed entirely in ADR-006
(2026-08-08, commit `15e2216`) — routes are flat today (`src/app/(public)/research/page.tsx`
renders at `/research`; route groups like `(public)` add no URL segment). `revalidatePath` does
not throw on a non-matching path — it silently no-ops. The result: **every admin write since
ADR-006 landed has called `revalidatePath` with a path that matches nothing**, so on-demand
invalidation has been a no-op in production for two days. The public site has only stayed
approximately current via the blind `export const revalidate = 3600` fallback in
`src/app/(public)/layout.tsx` — itself documented as "safety net only," not the primary freshness
mechanism it was standing in for.

Separately, a related gap: six public GET API routes (`/api/profile`, `/api/research`,
`/api/publications`, `/api/groups`, `/api/team-members`, `/api/events/upcoming`) call their
module's service directly rather than `fetch()`, so Next's Data Cache never applies to them, and
they carried no route-segment cache config — every request hit Postgres. They're not called by the
app's own pages (pages read through the service layer server-side directly), but they are a
documented public read API surface (`docs/architecture/backend.md`), publicly reachable, and worth
protecting from the same always-hits-the-database problem.

## Decision

1. **Fix `AREA_PATHS`** in `revalidate.ts` to the real flat paths (`/research`, `/publications`,
   `/team`, `/events`, `/appointment`) and change the `'profile'` case to
   `revalidatePath('/', 'layout')` (the public layout resolves to the root of the `(public)`
   route group).
2. **Cache five of the six public GET API routes** the same way Next already caches pages:
   `export const revalidate = 3600` per route module (300s for `/api/events/upcoming`, since an
   admin-declared appointment can pass into the past between invalidations — a shorter ceiling
   limits how long a stale-but-now-past event could be served). No `dynamic = 'force-static'` —
   plain `export const revalidate` is sufficient for a GET handler with no dynamic API usage.
   **`/api/team-members` is the exception and stays uncached** — see Correction below.
3. **Extend each `PublicArea` to also list its mirrored public API route(s)** so a single admin
   mutation purges both surfaces through the *same* on-demand cache Next already manages — not a
   second invalidation mechanism. E.g. area `research` now revalidates `/research` **and**
   `/api/research`. `team` still lists `/api/team-members` in this purge map even though the route
   itself isn't currently cacheable (harmless no-op today; correct if the route is ever made
   cacheable).

## Correction (2026-08-10, same day): `/api/team-members` does not cache

An initial version of this change added `export const revalidate = 3600` to all six routes,
including `/api/team-members`, on the reasoning that reading `request.nextUrl.searchParams` for
the optional `?groupId=` filter doesn't opt a GET route out of static caching. **That reasoning was
wrong for this route.** `next build`'s route table showed `ƒ /api/team-members` (Dynamic), not `○
Static`, with the build log stating plainly: "Dynamic server usage: Route /api/team-members
couldn't be rendered statically because it used `nextUrl.searchParams`." Unlike `cookies()`/
`headers()`/`draftMode()`, which are the commonly-cited dynamic APIs, **reading `searchParams` on
a request object is itself also a dynamic API use** in the App Router's static-analysis model —
the earlier claim that "none of the six use those [dynamic APIs]" was factually wrong for this one
route. The other five routes (`/api/profile`, `/api/research`, `/api/publications`, `/api/groups`,
`/api/events/upcoming`) take no request input at all and build as `○ Static` with their intended
revalidate ceilings.

`export const revalidate` was removed from `src/app/api/team-members/route.ts`, along with the
now-incorrect comment. The route stays a plain per-request DB read, same as before this change —
not a regression, just not the caching win originally claimed. `revalidate.ts`'s `team` area still
lists `/api/team-members` in its `revalidatePath` purge targets: calling `revalidatePath` on a
route that was never statically cached is a harmless no-op, and the entry becomes correct again if
the route is later restructured (e.g. two route modules, filtered vs. unfiltered) to be cacheable.

Considered and rejected: introducing a cache-tag system (`revalidateTag` + `unstable_cache`) for
finer-grained invalidation, or fronting reads with Upstash Redis as an app-level cache. Both were
rejected as new infrastructure the project doesn't need: `revalidatePath` per-route already gives
exact invalidation (no over-purging — each area maps to precisely the routes it feeds), the
project is Vercel + Supabase only (see `docs/deployment/deployment.md`) with a hard free-tier-only
constraint (see `CLAUDE.md`), and Upstash Redis in this project is scoped to rate limiting only —
repurposing it as an app cache would blur that boundary for no measured benefit. A cache-tag layer
would add real complexity (tag naming, `unstable_cache` wrapping) to solve a problem `revalidatePath`
already solves at the current scale (a handful of public routes, single admin, low write volume).

## Consequences

- On-demand invalidation actually works again: an admin save reaches the public site (and its
  mirrored API route) within the same request cycle, restoring the intended "fast cache, always
  current" behavior instead of silently degrading to the hourly fallback.
- Five of the six public GET API routes go from "DB hit every request" to cached-with-purge, at no
  infrastructure cost — same mechanism, more routes registered against it. `/api/team-members`
  stays a DB hit on every request (see Correction above) — accepted as-is at this app's traffic
  scale; not worth branching the handler to make the unfiltered case cacheable.
- `export const revalidate` ceilings (3600s / 300s for the time-sensitive events route) remain
  purely a safety net for changes made outside the app (direct DB edit, re-seed, restored backup),
  exactly as already documented for the public layout — this ADR doesn't change that role, only
  restores it and widens its coverage.
- A regression test now pins the literal paths (`src/modules/shared/lib/revalidate.test.ts`) so a
  future locale-style rename (or any path typo) fails loudly instead of silently no-opping again.

## Supersedes / Superseded by

Does not supersede ADR-006 (locale-routing removal) — this ADR fixes a downstream bug ADR-006's
change introduced (stale paths in `revalidate.ts` that ADR-006 didn't touch when it removed the
`[locale]` segment elsewhere).
