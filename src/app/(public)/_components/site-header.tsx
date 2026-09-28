// Prefetches on hover/focus rather than on sight — see intent-link.tsx.
import { IntentLink as Link } from '@/modules/shared/ui/intent-link';
import { DEFAULT_LAB_NAME, type Profile } from '@/modules/profile';
import { Guilloche } from '@/modules/shared/ui/guilloche';
import { MobileMenu, NavSidebar, type NavItem } from '@/modules/shared/ui/site-nav';
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

export { DEFAULT_LAB_NAME };

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
    // From `lg` up the band is `fixed` at exactly `--header-h` (a spacer in PublicShell holds its
    // full height in the flow), so the sidebar and the section nav stick directly beneath it, only
    // the page moves when scrolling, and condensing the band never re-lays out the page.
    <header
      data-sticky-header
      className="masthead-ground relative isolate z-30 overflow-hidden border-b border-masthead-foreground/10 text-masthead-foreground [--ring:var(--accent-on-band)] lg:fixed lg:inset-x-0 lg:top-0 lg:h-[var(--header-h)] lg:transition-[height] lg:duration-300 lg:ease-[var(--ease-out-expo)]"
    >
      {/* Fades the rosette out toward the text (its own mask belongs to the engraving sweep), so a
          long lab name never sits on dense linework. */}
      <div className="pointer-events-none absolute inset-y-0 right-0 -z-10 w-[min(44rem,100%)] [mask-image:linear-gradient(to_right,transparent,#000_55%)]">
        <Guilloche className="engrave absolute -right-28 -top-24 size-[20rem] text-engraving/30 sm:-right-20 sm:-top-36 sm:size-[34rem] sm:text-engraving/40" />
      </div>

      {/* A fixed top padding on desktop rather than vertical centring: the name must stay put while
          the band's height animates, and only the appointment button re-centres. */}
      <div className="flex items-start justify-between gap-6 px-6 py-6 sm:px-8 lg:h-full lg:pb-0 lg:pt-9">
        <Link href="/" className="focus-ring min-w-0 rounded-sm lg:mr-56">
          {/* Capped a step smaller while pinned, and at two lines, so a long name always fits the
              band's full height; `title` gives the full name back if it is ever clipped. */}
          <h1
            title={labName}
            className="header-name text-balance break-words font-serif text-display font-normal origin-top-left lg:line-clamp-2 lg:text-[clamp(2.25rem,1rem+2vw,3rem)] lg:transition-[scale,translate] lg:duration-300 lg:ease-[var(--ease-out-expo)]"
          >
            {labName}
          </h1>
          {profile?.labTagline && (
            <p className="header-extra mt-2 font-serif text-base italic leading-snug text-accent-on-band transition-opacity duration-200 sm:mt-3 sm:text-xl">
              {profile.labTagline}
            </p>
          )}
          {profile?.positionAffiliation && (
            <p className="header-extra mt-2 max-w-xl text-pretty text-sm leading-relaxed text-masthead-foreground/75 transition-opacity duration-200 lg:line-clamp-1">
              {profile.positionAffiliation}
            </p>
          )}
        </Link>

        {/* Centred on the band itself, so it stays centred as the band condenses. */}
        <div className="hidden lg:absolute lg:right-8 lg:top-1/2 lg:block lg:-translate-y-1/2">
          <AppointmentAction surface="band" />
        </div>
        <div className="lg:hidden">
          <MobileMenu items={TABS} label="Primary" footer={<AppointmentAction surface="sheet" />} />
        </div>
      </div>
    </header>
  );
}

/** The navigation sidebar beneath the header, from `lg` up. */
export function SiteSidebar() {
  return <NavSidebar items={TABS} label="Primary" />;
}
