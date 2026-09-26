import Link from 'next/link';
import type { Profile } from '@/modules/profile';
import { Guilloche } from '@/modules/shared/ui/guilloche';
import { MobileMenu, SidebarNav, type NavItem } from '@/modules/shared/ui/site-nav';
import { AppointmentAction } from './appointment-action';

// The public site's chrome on the pale green masthead ground (ADR-018): a full-width header band
// carrying the lab's name, tagline and affiliation (the name set in type is the mark — no logo),
// with a sidebar beneath it holding only the navigation from `lg` up. Below `lg` the sidebar is
// gone and the header's Menu button opens the same links in a sheet.
//
// The lab name is the page's single <h1>; each tab's own heading below is an <h2>.
//
// `--ring` is re-pointed at `--accent-on-band` inside both — plain `--accent` measures only 4.19:1
// on the band — so every `focus-ring` passes without a second focus style.

export const DEFAULT_LAB_NAME = 'The Culprit';

// "Make Appointment" is not in this list: it is the visitor's main action (AppointmentAction),
// shown in the header on desktop and at the foot of the menu sheet on mobile.
const TABS: readonly NavItem[] = [
  { href: '/', label: 'About', exact: true },
  { href: '/research', label: 'Research' },
  { href: '/publications', label: 'Publications' },
  { href: '/team', label: 'Team' },
  { href: '/events', label: 'Events' },
];

export function SiteHeader({ profile }: { profile: Profile | null }) {
  const labName = profile?.labName || DEFAULT_LAB_NAME;

  return (
    // From `lg` up the band is pinned (`sticky`) at exactly `--header-h`, so the sidebar and the
    // section nav can stick directly beneath it and only the page moves when scrolling.
    <header
      data-sticky-header
      className="masthead-ground relative isolate z-30 overflow-hidden border-b border-masthead-foreground/10 text-masthead-foreground [--ring:var(--accent-on-band)] lg:sticky lg:top-0 lg:h-[var(--header-h)]"
    >
      {/* Fades the rosette out toward the text (its own mask belongs to the engraving sweep), so a
          long lab name never sits on dense linework. */}
      <div className="pointer-events-none absolute inset-y-0 right-0 -z-10 w-[min(44rem,100%)] [mask-image:linear-gradient(to_right,transparent,#000_55%)]">
        <Guilloche className="engrave absolute -right-28 -top-24 size-[20rem] text-engraving/30 sm:-right-20 sm:-top-36 sm:size-[34rem] sm:text-engraving/40" />
      </div>

      <div className="flex items-start justify-between gap-6 px-6 py-6 sm:px-8 lg:h-full lg:items-center lg:py-0">
        <Link href="/" className="focus-ring min-w-0 rounded-sm">
          {/* Capped a step smaller while pinned, and at two lines, so a long name always fits the
              band's fixed height. */}
          <h1 className="text-balance break-words font-serif text-display font-normal lg:line-clamp-2 lg:text-[clamp(2.25rem,1rem+2vw,3rem)]">
            {labName}
          </h1>
          {profile?.labTagline && (
            <p className="mt-2 font-serif text-base italic leading-snug text-accent-on-band sm:mt-3 sm:text-xl">
              {profile.labTagline}
            </p>
          )}
          {profile?.positionAffiliation && (
            <p className="mt-2 max-w-xl text-pretty text-sm leading-relaxed text-masthead-foreground/75 lg:line-clamp-1">
              {profile.positionAffiliation}
            </p>
          )}
        </Link>

        <div className="hidden shrink-0 lg:block">
          <AppointmentAction surface="band" />
        </div>
        <div className="lg:hidden">
          <MobileMenu items={TABS} label="Primary" footer={<AppointmentAction surface="sheet" />} />
        </div>
      </div>
    </header>
  );
}

/**
 * The navigation column under the header, from `lg` up. A lighter wash of the masthead green, so
 * header and sidebar read as one L-shaped frame around the white page. The list sticks directly
 * under the pinned header, so neither moves while the page scrolls.
 */
export function SiteSidebar() {
  return (
    <aside className="hidden border-r border-masthead-foreground/10 bg-[color-mix(in_srgb,var(--masthead)_45%,var(--surface))] [--ring:var(--accent-on-band)] lg:block">
      <div className="sticky top-[var(--header-h)] max-h-[calc(100dvh-var(--header-h))] overflow-y-auto px-4 py-8">
        <SidebarNav items={TABS} label="Primary" />
      </div>
    </aside>
  );
}
