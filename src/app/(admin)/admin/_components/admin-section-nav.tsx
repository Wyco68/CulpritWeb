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
    <nav aria-label="On this page" className={cn('lg:sticky lg:top-8 lg:self-start', className)}>
      {/* Horizontal chip run on narrow screens (a vertical rail would push the content a screen
          down); a rail on wide ones, where there is a column to spare. */}
      <ul className="scroll-fade -mx-1 flex gap-1 overflow-x-auto scrollbar-hidden px-1 lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-0">
        {sections.map(({ id, label }) => {
          const active = id === activeId;
          return (
            <li key={id}>
              <a
                href={`#${id}`}
                aria-current={active ? 'location' : undefined}
                onClick={() => setActiveId(id)}
                className={cn(
                  // The 2px accent marker is the same active-navigation cue the public and admin
                  // tab bars already use, turned on its side for a vertical rail. It is applied
                  // only from `lg` up, where the list actually is a rail — on narrow screens the
                  // items are chips in a row and a left edge marker would read as a stray line.
                  'block whitespace-nowrap rounded-sm px-3 py-1.5 text-sm tracking-tight transition-[color,border-color] duration-300 ease-[var(--ease-out-expo)] hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring lg:whitespace-normal lg:border-l-2',
                  active
                    ? 'font-medium text-foreground lg:border-accent'
                    : 'text-muted-foreground lg:border-transparent',
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
