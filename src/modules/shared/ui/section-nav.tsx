'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/modules/shared/lib/utils';

// In-page jump list for the public tabs that stack several sections (Research, Teaching, Team
// Members, About). The seven tabs stay seven crawlable URLs — Publications in particular is a
// page people link to — so this navigates *within* a tab rather than replacing the tab bar.
//
// Deliberately plain anchors inside a <nav>, not buttons calling scrollIntoView():
//
//  - Cmd/Ctrl-click, middle-click, "open in new tab" and "copy link address" all work, because the
//    browser is doing the navigating. A click handler on a <div> throws every one of those away.
//  - The scroll animation is the browser's, so it already obeys `prefers-reduced-motion` through
//    the `scroll-behavior: auto` override in globals.css. Scripted smooth scrolling would have to
//    re-check that query by hand, and usually doesn't.
//  - Landing on /research#works from outside works with no JavaScript at all; the offset comes
//    from `scroll-padding-top`/`scroll-margin-top` in globals.css, not from a measured scroll.
//
// The only thing script adds is *reflecting* where the reader already is: highlighting the current
// entry and keeping the hash in step, so the URL in the address bar is always the URL that would
// bring someone back to this spot.

export interface SectionNavItem {
  /** `id` of the element on the page this entry jumps to. */
  id: string;
  /** Short label for the strip. Need not repeat the section heading verbatim. */
  label: string;
}

export interface SectionNavProps {
  items: SectionNavItem[];
  /** Accessible name for the landmark. Distinguishes it from the site's "Primary" tab bar. */
  label?: string;
  className?: string;
}

/**
 * Distance from the top of the viewport at which a section counts as "current". Matches
 * `--anchor-offset` in globals.css plus a few pixels, so a section becomes active exactly as its
 * heading settles into the position an anchor jump would have left it in.
 */
const ACTIVE_LINE_PX = 76;

export function SectionNav({ items, label = 'On this page', className }: SectionNavProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  // A single item is not a choice, and zero is not a list — either way the strip would be a row of
  // chrome that tells the reader nothing. Callers pass only the sections that actually have
  // content, so this is the one place the "don't render an empty jump list" rule lives.
  const enabled = items.length > 1;

  // Depend on the ids, not the array: callers build `items` inline, so a fresh array identity on
  // every parent render would tear down and re-attach the scroll listener for no reason.
  const idsKey = items.map((item) => item.id).join('|');

  useEffect(() => {
    if (!enabled) return;

    const elements = idsKey
      .split('|')
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null);
    if (elements.length === 0) return;

    let frame = 0;

    // The active section is the last one whose top has passed the line — the same rule the eye
    // uses. Measured from `getBoundingClientRect` rather than tracked through IntersectionObserver
    // entries: the observer only reports crossings, and a short final section that can never reach
    // the line would leave the last entry permanently unreachable.
    const measure = () => {
      frame = 0;
      let current = elements[0];
      for (const element of elements) {
        if (element.getBoundingClientRect().top <= ACTIVE_LINE_PX) current = element;
      }
      // At the very bottom of the document the remaining sections can no longer scroll up to the
      // line, so the last one wins — otherwise scrolling to the end never highlights the end.
      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      if (atBottom) current = elements[elements.length - 1];
      setActiveId(current?.id ?? null);
    };

    // rAF-coalesced: scroll fires far more often than the browser paints, and this reads layout.
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [enabled, idsKey]);

  // Keep the address bar honest, so copying the URL mid-page yields a link back to this section.
  // `replaceState`, not `pushState`: pushing would fill the history stack with one entry per
  // section crossed and turn the Back button into a scroll-position rewind.
  useEffect(() => {
    if (!activeId) return;
    // Don't write a hash onto a URL that was shared without one until the reader has actually
    // moved. Arriving at /research and immediately seeing /research#statement is a URL the visitor
    // did not ask for.
    if (!window.location.hash && window.scrollY < ACTIVE_LINE_PX) return;
    if (window.location.hash === `#${activeId}`) return;
    window.history.replaceState(null, '', `#${activeId}`);
  }, [activeId]);

  if (!enabled) return null;

  return (
    <nav
      aria-label={label}
      className={cn(
        // Full width of the content column's padding box, so the rule underneath reads as a
        // divider across the page rather than a floating pill.
        'sticky top-0 z-20 -mx-6 border-b border-border bg-background/90 px-6 backdrop-blur-sm',
        className,
      )}
    >
      {/* Same scrolling strip as the site tab bar: the labels are the section headings, some of
          which are long, and wrapping them onto a second line would make the sticky bar tall
          enough to eat the content it is meant to help you reach. */}
      <div className="scroll-fade scrollbar-hidden overflow-x-auto">
        <ul className="flex min-w-max items-center gap-1 py-2">
          {items.map((item) => {
            const active = item.id === activeId;
            return (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  // `location`, not `page`: this marks a position within the current document.
                  // `aria-current="page"` is the site tab bar's, and belongs to one link only.
                  aria-current={active ? 'location' : undefined}
                  className={cn(
                    'inline-flex items-center whitespace-nowrap rounded-sm px-2.5 py-1.5 text-sm tracking-tight transition-colors duration-300 ease-[var(--ease-out-expo)] hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                    // Weight as well as colour: the current entry must not be signalled by hue
                    // alone (WCAG 2.1 AA §1.4.1).
                    active ? 'font-medium text-accent' : 'text-muted-foreground',
                  )}
                >
                  {item.label}
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
