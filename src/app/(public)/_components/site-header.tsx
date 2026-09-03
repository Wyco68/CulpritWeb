import Link from 'next/link';
import { Avatar } from '@/modules/shared/ui/avatar';
import type { Profile } from '@/modules/profile';
import { NavTabs } from './nav-tabs';

// The masthead: a deep ink band carrying the portrait, the name, and the tab bar. It is the only
// inverted surface in the design — an editorial device (the head of a printed page), not a
// decorative dark section dropped into a light layout.
//
// Rendered once by the (public) layout so it's shared across every tab instead of duplicated per
// page. The professor's name is the page's single <h1> for the whole site shell; each tab's own
// heading below is an <h2>.
//
// Note the two accents: `--accent` is unreadable on ink (2.15:1), so anything tinted on this
// surface uses `--accent-on-band` (5.17:1). See globals.css.
export async function SiteHeader({ profile }: { profile: Profile | null }) {
  const fullName = profile?.fullName || 'The Culprit';
  const initials = fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (
    <header className="relative bg-masthead text-masthead-foreground">
      <div className="mx-auto max-w-6xl px-6 pt-14 sm:px-8 sm:pt-20">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:gap-8">
          <Link
            href="/"
            className="group inline-flex flex-col gap-6 rounded-[16px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-on-band sm:flex-row sm:items-end sm:gap-8"
          >
            {/* Mounted-print portrait: the photo sits on a small card (padding + a raised
                shadow) rather than bare on the band, like a print mounted on stock. The mount is
                a shade of the band itself, not white — see --masthead-mount. */}
            <div className="rounded-[calc(var(--radius-container)+0.5rem)] bg-masthead-mount p-2 shadow-raised transition-[translate] duration-700 ease-[var(--ease-out-expo)] group-hover:-translate-y-0.5">
              <Avatar
                src={profile?.photoUrl}
                alt={`Portrait of ${fullName}`}
                fallback={initials || '?'}
                size="lg"
                className="!rounded-[calc(var(--radius-container)+0.125rem)]"
              />
            </div>
            <div className="pb-1">
              {/* The name is set in the text serif at display size with negative tracking — the
                  single largest typographic gesture on the site, and the thing a visitor came to
                  read. `text-balance` stops a two-word surname from stranding on its own line. */}
              <h1 className="text-pretty font-serif text-[2.125rem] font-normal leading-[1.05] tracking-[-0.02em] sm:text-6xl">
                {fullName}
              </h1>
              {profile?.title && (
                <p className="mt-3 font-serif text-lg italic text-accent-on-band sm:text-xl">
                  {profile.title}
                </p>
              )}
              {profile?.positionAffiliation && (
                <p className="mt-2 max-w-xl text-pretty text-sm leading-relaxed text-masthead-foreground/70">
                  {profile.positionAffiliation}
                </p>
              )}
            </div>
          </Link>
        </div>

        <div className="mt-10 border-t border-masthead-foreground/12 sm:mt-14">
          <NavTabs />
        </div>
      </div>
    </header>
  );
}
