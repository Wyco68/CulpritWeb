'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/modules/shared/lib/utils';

// The admin section's tab bar — same visual language as the public `NavTabs` (underlined active
// tab on the navy band) but a real `nav`/links list here too: each destination is a distinct
// routed page with its own data load, not a same-document panel.
const TABS = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/profile', label: 'Profile' },
  { href: '/admin/research', label: 'Research' },
  { href: '/admin/publications', label: 'Publications' },
  { href: '/admin/groups', label: 'Research Groups' },
  { href: '/admin/team-members', label: 'Team Members' },
  { href: '/admin/appointments', label: 'Appointments' },
] as const;

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin" className="-mb-px overflow-x-auto scrollbar-hidden">
      <ul className="flex min-w-max items-center gap-1 sm:gap-2">
        {TABS.map(({ href, label }) => {
          const active = href === '/admin' ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex items-center whitespace-nowrap border-b-2 px-3 py-3 text-sm font-semibold tracking-tight text-navy-foreground transition-colors hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                  active ? 'border-accent font-bold text-accent' : 'border-transparent',
                )}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
