'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/modules/shared/lib/utils';

// The public tab bar. These are real routed pages (each server-rendered with its own metadata for
// crawlability), not same-document panels — so this is a `nav` of links with `aria-current`, not
// an ARIA `tablist`/`tab` widget. The WAI-ARIA Authoring Practices reserve the tabs pattern for
// switching panels within one page; applying it to cross-page navigation would misrepresent the
// widget to assistive tech (arrow-key panel semantics that don't apply to full navigations).
// Visually it still reproduces the prototype's underlined-active-tab look.
const TABS = [
  { href: '/', key: 'about' },
  { href: '/research', key: 'research' },
  { href: '/publications', key: 'publications' },
  { href: '/team', key: 'team' },
  { href: '/events', key: 'events' },
  { href: '/appointment', key: 'appointment' },
] as const;

export function NavTabs() {
  const t = useTranslations('nav');
  const pathname = usePathname();

  return (
    <nav aria-label={t('ariaLabel')} className="-mb-px overflow-x-auto scrollbar-hidden">
      <ul className="flex min-w-max items-center gap-1 sm:gap-2">
        {TABS.map(({ href, key }) => {
          const active = pathname === href;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex items-center whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium tracking-tight text-navy-foreground/65 transition-colors hover:text-navy-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                  active
                    ? 'border-accent font-semibold text-navy-foreground'
                    : 'border-transparent',
                )}
              >
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
