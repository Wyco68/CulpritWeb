'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/modules/shared/lib/utils';

// A jump list for the merged admin screens.
//
// Since each admin screen now mirrors one public tab, the long ones (About carries the identity,
// the bio, the links and four CV lists) are a single scrolling document rather than four
// destinations. That is the right model — the admin edits "the About tab", not "the education
// table" — but a document that long needs a table of contents, otherwise the price of merging is
// scrolling.
//
// The active section is mirrored into the URL fragment so a position is linkable and survives a
// reload: `history.replaceState`, not `router.replace`, because scrolling is not navigation and
// should neither push history entries nor re-render the server tree.

export interface AdminSectionNavProps {
  /** `id` must match an element on the page; those elements carry `scroll-mt-*` for the header. */
  sections: readonly { id: string; label: string }[];
  className?: string;
}

export function AdminSectionNav({ sections, className }: AdminSectionNavProps) {
  const [activeId, setActiveId] = useState<string>(() => sections[0]?.id ?? '');

  useEffect(() => {
    // jsdom (and any pre-2019 browser) has no IntersectionObserver. The list still navigates —
    // these are ordinary fragment links — it just doesn't highlight.
    if (typeof IntersectionObserver === 'undefined') return;

    const targets = sections
      .map((section) => document.getElementById(section.id))
      .filter((element): element is HTMLElement => element !== null);
    if (targets.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const next = visible[0]?.target.id;
        if (next) setActiveId(next);
      },
      // Top band of the viewport, below the sticky masthead: the section you are reading is the
      // one whose heading has most recently passed under the header, not whichever occupies the
      // most pixels.
      { rootMargin: '-88px 0px -70% 0px', threshold: 0 },
    );

    for (const target of targets) observer.observe(target);
    return () => observer.disconnect();
  }, [sections]);

  useEffect(() => {
    if (!activeId) return;
    const url = `${window.location.pathname}${window.location.search}#${activeId}`;
    if (`${window.location.pathname}${window.location.search}${window.location.hash}` === url) {
      return;
    }
    window.history.replaceState(null, '', url);
  }, [activeId]);

  if (sections.length === 0) return null;

  return (
    <nav
      aria-label="On this page"
      className={cn(
        // A real sidebar panel on wide screens: its own surface, a defined edge, and a sticky
        // position so it stays beside the content as the document scrolls. On narrow screens the
        // panel chrome is dropped — a boxed rail would push the content a full screen down — and it
        // falls back to the horizontal chip run the public tabs use.
        'lg:sticky lg:top-8 lg:self-start lg:rounded-lg lg:border lg:border-border-strong lg:bg-surface lg:p-3 lg:shadow-hairline',
        className,
      )}
    >
      <p className="hidden px-3 pb-2 font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-muted-foreground lg:block">
        On this page
      </p>
      <ul className="scroll-fade -mx-1 flex gap-1 overflow-x-auto scrollbar-hidden px-1 lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:px-0">
        {sections.map(({ id, label }) => {
          const active = id === activeId;
          return (
            <li key={id}>
              <a
                href={`#${id}`}
                aria-current={active ? 'location' : undefined}
                onClick={() => setActiveId(id)}
                className={cn(
                  // From `lg` up each entry is a full-width sidebar row: the active one fills with
                  // the muted surface and takes an accent left marker, the resting sidebar pattern.
                  // On narrow screens the same items are chips in a row, where a fill and an edge
                  // marker would read as clutter, so both are gated behind `lg`.
                  'block whitespace-nowrap rounded-sm px-3 py-1.5 text-sm tracking-tight transition-[color,background-color,border-color] duration-300 ease-[var(--ease-out-expo)] hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring lg:whitespace-normal lg:rounded-md lg:border-l-2',
                  active
                    ? 'font-medium text-foreground lg:border-accent lg:bg-muted'
                    : 'text-muted-foreground lg:border-transparent lg:hover:bg-muted/50',
                )}
              >
                {label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
