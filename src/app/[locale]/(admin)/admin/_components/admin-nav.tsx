'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/modules/shared/lib/utils';

// The admin section's tab bar — same visual language as the public `NavTabs` (underlined active
// tab on the navy band) but a real `nav`/links list here too: each destination is a distinct
// routed page with its own data load, not a same-document panel.
const TABS = [
  { href: '/admin', key: 'dashboard' },
  { href: '/admin/profile', key: 'profile' },
  { href: '/admin/research', key: 'research' },
  { href: '/admin/publications', key: 'publications' },
  { href: '/admin/groups', key: 'groups' },
  { href: '/admin/team-members', key: 'teamMembers' },
  { href: '/admin/appointments', key: 'appointments' },
  { href: '/admin/settings', key: 'settings' },
] as const;

export function AdminNav() {
  const t = useTranslations('admin.nav');
  const pathname = usePathname();

  return (
    <nav aria-label={t('ariaLabel')} className="-mb-px overflow-x-auto scrollbar-hidden">
      <ul className="flex min-w-max items-center gap-1 sm:gap-2">
        {TABS.map(({ href, key }) => {
          const active = href === '/admin' ? pathname === href : pathname.startsWith(href);
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
