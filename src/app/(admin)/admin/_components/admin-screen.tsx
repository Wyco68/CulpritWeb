import type * as React from 'react';
import { PageHeading } from '@/modules/shared/ui/page-heading';
import { AdminSectionNav } from './admin-section-nav';

// The shell every admin content screen shares: one `h1` naming the public tab it mirrors, an
// optional jump list, and a single column of sections beneath.
//
// It exists so the eight screens can't drift apart the way the old entity-shaped ones did (six
// hand-rolled headings, three different gap scales). Screens with three or more sections get the
// jump list; the short ones (Publications, Events, Appointment) don't, because a table of contents
// for two headings is furniture.

export interface AdminScreenSection {
  /** Must match the anchor id rendered by the corresponding section component. */
  id: string;
  label: string;
}

export interface AdminScreenProps {
  title: string;
  intro?: string;
  /** Omit — or pass fewer than three — to render a single column with no jump list. */
  sections?: readonly AdminScreenSection[];
  children: React.ReactNode;
}

/** Below this, a jump list costs more attention than the scrolling it saves. */
const MIN_SECTIONS_FOR_NAV = 3;

export function AdminScreen({ title, intro, sections, children }: AdminScreenProps) {
  const showNav = (sections?.length ?? 0) >= MIN_SECTIONS_FOR_NAV;

  return (
    <div className="flex flex-col gap-10">
      <PageHeading as="h1" title={title} intro={intro} />

      {showNav && sections ? (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,12rem)_minmax(0,1fr)] lg:gap-14">
          <AdminSectionNav sections={sections} />
          {/* `min-w-0` so a wide table scrolls inside its own box instead of widening the grid
              track and pushing the rail off screen. */}
          <div className="flex min-w-0 flex-col gap-12 pb-8">{children}</div>
        </div>
      ) : (
        <div className="flex min-w-0 flex-col gap-12 pb-8">{children}</div>
      )}
    </div>
  );
}
