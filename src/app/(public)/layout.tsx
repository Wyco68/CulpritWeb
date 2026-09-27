import { getProfileCached } from '@/modules/profile';
import { PublicShell } from './_components/public-shell';

// Shared shell for every public tab (About, Research, Publications, Team, Events,
// Make Appointment): the sidebar / top bar render once here, so each page below
// only supplies its own tab content. Server Component — reads the profile directly through the
// service layer (no internal HTTP round-trip) per the "public read pages fetch through services"
// architecture rule.
//
// Deliberately NO `loading.tsx` beside this layout. A loading boundary here reads well in dev,
// where a cold route compile leaves the old tab on screen for a second or two — but it converts
// these routes from prerendered HTML (`x-nextjs-cache: HIT`, ~5ms) into a streamed per-request
// render that hits the database on every visit (~150ms, measured). In production there is no wait
// worth papering over, so the cache wins. The admin section keeps its boundary: those pages are
// session-gated and re-render per request regardless.

// Safety net only. Every admin write already invalidates the pages it affects on demand (see
// modules/shared/lib/revalidate), which is what keeps the public site current within a request or
// two. This daily ceiling just bounds how long a change made *outside* the app — a direct DB edit,
// a re-seed, a restored backup — could otherwise sit invisible behind the Full Route Cache. It was
// hourly; each expiry is a regeneration (a function run, its queries and a cache write) on the
// host's free tier, and on-demand purges already cover every admin edit, so a day is enough.
export const revalidate = 86400;

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const result = await getProfileCached();
  const profile = result.ok ? result.data : null;

  return <PublicShell profile={profile}>{children}</PublicShell>;
}
