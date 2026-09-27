'use client';

import { useEffect, useState, type ReactNode } from 'react';
// Prefetches on hover/focus rather than on sight — see intent-link.tsx.
import { IntentLink as Link } from '@/modules/shared/ui/intent-link';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { cn } from '@/modules/shared/lib/utils';
import { Sheet } from './sheet';

// Site navigation, shared by the public site and the admin.
//
// These are real routed pages, each server-rendered with its own metadata, so this is a `nav` of
// links with `aria-current` — not an ARIA `tablist`, which is reserved for switching panels within
// one page. From `lg` up the links stand in a vertical sidebar (`SidebarNav`); below that, a
// "Menu" button in the top bar opens a side sheet with the same links (`MobileMenu`).

export interface NavItem {
  href: string;
  label: string;
  /** Match the path exactly. Otherwise the item also stays current on its sub-pages. */
  exact?: boolean;
}

function isActive(pathname: string, { href, exact }: NavItem) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({ items, label }: { items: readonly NavItem[]; label: string }) {
  const pathname = usePathname();

  return (
    <nav aria-label={label}>
      <ul className="flex flex-col gap-0.5">
        {items.map((item) => {
          const active = isActive(pathname, item);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  // The active entry takes a white fill and an accent bar on its left edge; the bar
                  // is a second cue beside the fill, so the state is not carried by colour alone.
                  'focus-ring relative flex min-h-11 items-center rounded-md px-3.5 text-[0.9375rem] transition-[color,background-color] duration-200 ease-[var(--ease-out-expo)]',
                  'before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-pill before:transition-[scale,background-color] before:duration-300 before:ease-[var(--ease-out-expo)]',
                  active
                    ? 'bg-surface font-medium text-masthead-foreground shadow-hairline before:scale-y-100 before:bg-accent-on-band'
                    : 'text-masthead-foreground/75 before:scale-y-0 hover:bg-masthead-foreground/[0.06] hover:text-masthead-foreground',
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * The navigation column under the header, from `lg` up, shared by the public site and the admin.
 * A lighter wash of the masthead green, so header and sidebar read as one L-shaped frame around
 * the white page. The list sticks directly under the pinned header, so neither moves while the
 * page scrolls.
 */
export function NavSidebar({ items, label }: { items: readonly NavItem[]; label: string }) {
  return (
    <aside className="hidden border-r border-masthead-foreground/10 bg-[color-mix(in_srgb,var(--masthead)_45%,var(--surface))] [--ring:var(--accent-on-band)] lg:block">
      <div className="sticky top-[var(--header-h)] max-h-[calc(100dvh-var(--header-h))] overflow-y-auto px-4 py-8 transition-[top,max-height] duration-300 ease-[var(--ease-out-expo)]">
        <SidebarNav items={items} label={label} />
      </div>
    </aside>
  );
}

export function MobileMenu({
  items,
  label,
  footer,
}: {
  items: readonly NavItem[];
  label: string;
  /** Rendered under the links — the primary action for that side of the app. */
  footer?: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // A navigation replaces the page under the sheet; the sheet itself should not outlive it.
  useEffect(() => setOpen(false), [pathname]);

  return (
    // `shrink-0`: beside a long lab name the flex row would otherwise squeeze the button until
    // its icon collapsed to zero width.
    <div className="shrink-0">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="focus-ring inline-flex h-11 items-center gap-2 rounded-sm border border-masthead-foreground/25 px-3.5 text-sm font-medium text-masthead-foreground transition-colors duration-200 hover:bg-masthead-foreground/10"
      >
        <Menu className="size-5 shrink-0" aria-hidden="true" />
        Menu
      </button>

      <Sheet open={open} onOpenChange={setOpen} title="Menu">
        <nav aria-label={label}>
          <ul className="flex flex-col gap-1">
            {items.map((item) => {
              const active = isActive(pathname, item);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'focus-ring flex min-h-12 items-center rounded-md border-l-2 px-4 text-base transition-colors duration-200',
                      active
                        ? 'border-accent bg-muted font-medium text-foreground'
                        : 'border-transparent text-foreground hover:bg-muted/60',
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        {footer && (
          // A link here may point at the page already open, where no navigation happens to close
          // the sheet — so any link click closes it directly.
          <div
            className="rule-double mt-6 pt-6"
            onClick={(event) => {
              if ((event.target as Element).closest('a')) setOpen(false);
            }}
          >
            {footer}
          </div>
        )}
      </Sheet>
    </div>
  );
}
