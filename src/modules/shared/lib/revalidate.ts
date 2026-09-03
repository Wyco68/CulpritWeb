import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { purgeCloudflareCache } from './cloudflare-cache';
import type { Result } from './result';

// Public-page (and public-API) cache invalidation.
//
// Every public page is prerendered — it reads its content through a service at render time and is
// then served from the Full Route Cache, which is why public navigation costs ~5ms instead of a
// round trip to the database region. The flip side is that nothing in the cache expires on its
// own: without an explicit signal, an admin edit would never reach the public site until the next
// deploy. This module is that signal, so the site stays both fast and current.
//
// Paths are written in their real, rendered form (e.g. `/research`), not a route-template form.
// Routing is flat — there is no `[locale]` segment (removed in ADR-006, 2026-08-08); route groups
// like `(public)` don't add a URL segment, so `src/app/(public)/research/page.tsx` renders at
// exactly `/research`. `revalidatePath` silently no-ops on a non-matching path (it never throws),
// which is how the previous `/[locale]/...` paths went unnoticed as dead invalidation calls — see
// ADR-007.
//
// Each area also lists the public GET API route(s) that mirror the same content, so one admin
// mutation purges both the page and the API response from the same on-demand cache.

/** Public surfaces (and their mirrored public API routes) that admin-editable content feeds. */
const AREA_PATHS = {
  research: ['/research', '/api/research'],
  publications: ['/publications', '/api/publications'],
  /**
   * Research groups and their members share the Team Members tab. Only the unfiltered
   * `/api/team-members` route is purged here — its per-group sibling
   * `/api/team-members/group/{groupId}` (see ADR-007's addendum) has no fixed path to target,
   * since the id is only known at request time, so it isn't covered by on-demand invalidation.
   * That's an accepted gap, not an oversight: it relies on its own 3600s `revalidate` ceiling
   * alone, same tradeoff already made for `/api/events/upcoming`'s time-sensitivity, just longer
   * because group membership changes are rare and low-stakes if briefly stale.
   */
  team: ['/team', '/api/groups', '/api/team-members'],
  /** The Events tab — both halves (upcoming and past) come from the same list. */
  events: ['/events', '/api/events'],
  /** The Teaching tab: courses plus the two teaching CV lists. */
  teaching: ['/teaching', '/api/teaching'],
  /**
   * The About tab alone. Separate from `'profile'`, which drops the whole layout subtree because
   * the professor's name and photo render in the site header on every page. A CV entry only
   * changes the body of `/`, so purging the entire tree for it would be indiscriminate.
   */
  about: ['/'],
  /**
   * The Make Appointment tab (Calendly embed only). No matching public API route, and nothing
   * server-side writes to it — kept because the page exists and the area name is part of this
   * module's public contract, not because any current mutation invalidates it.
   */
  appointment: ['/appointment'],
} as const;

export type PublicArea = keyof typeof AREA_PATHS;

/**
 * Every public PAGE url (no `/api/*`), derived from the areas above so a new tab can't be
 * forgotten here. Used by the `'profile'` purge, which affects all of them.
 */
const PUBLIC_PAGE_PATHS: string[] = [
  ...new Set(Object.values(AREA_PATHS).flatMap((paths) => paths.filter((p) => !p.startsWith('/api/')))),
];

/**
 * Invalidate the public pages (and mirrored public API routes) affected by a change.
 *
 * Use `'profile'` for profile edits: the professor's name, title and photo render in the site
 * header, which lives in the public *layout* and therefore appears on every tab — so a profile
 * save has to drop the whole subtree, not just the About page. `/api/profile` is purged alongside it.
 */
export function revalidatePublic(...areas: (PublicArea | 'profile')[]): void {
  const purgePaths: string[] = [];
  for (const area of areas) {
    if (area === 'profile') {
      // Next's own invalidation: `('/', 'layout')` drops the root layout and every page nested
      // under it, so all seven public tabs are covered at the origin by this one call.
      revalidatePath('/', 'layout');
      revalidatePath('/api/profile');
      // Cloudflare purges by explicit file URL, so the subtree semantics above do NOT carry over —
      // listing only `/` would leave the other tabs served from the edge until their own TTL. The
      // profile row feeds every tab (the header name/photo on all of them, and since 2026-09-02
      // the per-tab intro copy on five of them), so every public page URL is named here.
      purgePaths.push('/api/profile', ...PUBLIC_PAGE_PATHS);
    } else {
      for (const path of AREA_PATHS[area]) revalidatePath(path);
      purgePaths.push(...AREA_PATHS[area]);
    }
  }

  // Cloudflare purge runs after the response is sent (`after()`), and is a no-op without
  // CLOUDFLARE_API_TOKEN/CLOUDFLARE_ZONE_ID configured — see cloudflare-cache.ts. Batched into one
  // call per `revalidatePublic` invocation (not one per area/path) so an admin edit that touches
  // several areas at once doesn't fire a purge storm — see docs/decisions for the reasoning.
  // Guarded: `after` throws when called outside a real request scope (e.g. a unit test invoking
  // this function directly rather than through a route handler).
  try {
    after(() => purgeCloudflareCache(purgePaths));
  } catch {
    // Outside a request scope — nothing to schedule against. Not worth mocking `after` to avoid
    // this; `purgeCloudflareCache` itself is covered by its own tests.
  }
}

/**
 * Revalidate only when the operation actually succeeded, then hand the Result straight back so a
 * route handler can stay a one-liner: `return respond(revalidateOn(result, 'research'), 201)`.
 * A rejected transition (409) or a not-found id changed nothing, so it must not evict a good
 * cached page.
 */
export function revalidateOn<T, E>(result: Result<T, E>, ...areas: (PublicArea | 'profile')[]) {
  if (result.ok) revalidatePublic(...areas);
  return result;
}
