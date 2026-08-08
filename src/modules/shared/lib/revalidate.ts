import { revalidatePath } from 'next/cache';
import type { Result } from './result';

// Public-page cache invalidation.
//
// Every public page is prerendered — it reads its content through a service at render time and is
// then served from the Full Route Cache, which is why public navigation costs ~5ms instead of a
// round trip to the database region. The flip side is that nothing in the cache expires on its
// own: without an explicit signal, an admin edit would never reach the public site until the next
// deploy. This module is that signal, so the site stays both fast and current.
//
// Paths are written in their *route* form (`/[locale]/research`), not their rendered form
// (`/research`), because that is how the App Router identifies a route internally: the locale is a
// real dynamic segment, and the bare `/research` URL is a middleware rewrite of `/en/research`.
// The route form also invalidates every locale of a page at once, so adding a second language to
// `routing.locales` needs no change here.

/** Public surfaces that admin-editable content feeds, mapped to the routes that render them. */
const AREA_PATHS = {
  research: '/[locale]/research',
  publications: '/[locale]/publications',
  /** Research groups and their members share the Team Members tab. */
  team: '/[locale]/team',
  /** Upcoming Events: both the appointment list and the admin visibility toggle. */
  events: '/[locale]/events',
  /** The Make Appointment tab (slot duration comes from settings). */
  appointment: '/[locale]/appointment',
} as const;

export type PublicArea = keyof typeof AREA_PATHS;

/**
 * Invalidate the public pages affected by a change.
 *
 * Use `'profile'` for profile edits: the professor's name, title and photo render in the site
 * header, which lives in the public *layout* and therefore appears on every tab — so a profile
 * save has to drop the whole subtree, not just the About page.
 */
export function revalidatePublic(...areas: (PublicArea | 'profile')[]): void {
  for (const area of areas) {
    if (area === 'profile') revalidatePath('/[locale]', 'layout');
    else revalidatePath(AREA_PATHS[area], 'page');
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
