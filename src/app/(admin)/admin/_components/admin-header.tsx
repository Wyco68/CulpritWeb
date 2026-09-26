import Link from 'next/link';
import { LogoutButton } from '@/modules/auth';
import { Guilloche } from '@/modules/shared/ui/guilloche';
import { MobileMenu, NavSidebar, type NavItem } from '@/modules/shared/ui/site-nav';

// The admin's chrome, matching the public site (ADR-018): a compact header band across the top,
// with a navigation sidebar beneath it from `lg` up — both pinned, so only the screen scrolls. Below `lg` the header's Menu button opens the
// same links in a sheet.
//
// Static text on purpose — no profile read — so the chrome never waits on the database. The
// rosette is here for continuity but does not animate: a working screen should not move on its
// own.

// Each entry mirrors one public tab, so the admin edits a page by going to the screen of the same
// name.
const TABS: readonly NavItem[] = [
  { href: '/admin', label: 'Dashboard', exact: true },
  { href: '/admin/about', label: 'About' },
  { href: '/admin/research', label: 'Research' },
  { href: '/admin/publications', label: 'Publications' },
  { href: '/admin/team', label: 'Team' },
  { href: '/admin/events', label: 'Events' },
  { href: '/admin/appointment', label: 'Appointment' },
];

export function AdminHeader() {
  return (
    <header
      data-sticky-header
      className="masthead-ground relative isolate z-30 overflow-hidden border-b border-masthead-foreground/10 text-masthead-foreground [--ring:var(--accent-on-band)] lg:sticky lg:top-0 lg:h-[var(--header-h)]"
    >
      <Guilloche className="absolute -right-24 -top-40 -z-10 size-[22rem] text-engraving/25" />

      <div className="flex items-center justify-between gap-4 px-6 py-4 sm:px-8 lg:h-full lg:py-0">
        <Link href="/admin" className="focus-ring flex min-w-0 items-baseline gap-3 rounded-sm">
          <span className="truncate font-serif text-2xl">The Culprit</span>
          <span className="shrink-0 rounded-pill border border-masthead-foreground/30 px-2.5 py-0.5 text-xs font-medium text-accent-on-band">
            Admin
          </span>
        </Link>

        <div className="hidden lg:block">
          <LogoutButton surface="band" />
        </div>
        <div className="lg:hidden">
          <MobileMenu items={TABS} label="Admin" footer={<LogoutButton surface="sheet" />} />
        </div>
      </div>
    </header>
  );
}

/** The navigation sidebar beneath the header, from `lg` up. */
export function AdminSidebar() {
  return <NavSidebar items={TABS} label="Admin" />;
}
