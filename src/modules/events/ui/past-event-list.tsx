'use client';

import { useState } from 'react';
import { cn } from '@/modules/shared/lib/utils';
import { dateFormatter } from './event-media';
import { EventDetailDialog } from './event-detail-dialog';
import type { Event } from '../event.types';

/**
 * Past events: a wrapped row of compact date+title chips rather than the Upcoming tab's full
 * cards — a past event is scannable-first, and a growing archive of full cards would dominate the
 * page. Selecting a chip opens the same detail dialog the Upcoming cards use, so the archive and
 * the upcoming list present an event identically; the row itself never reflows, because nothing
 * expands inside it.
 */
export function PastEventList({ events }: { events: Event[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = events.find((event) => event.id === selectedId);

  return (
    <div>
      <ul className="flex flex-wrap gap-2.5">
        {events.map((event, index) => {
          const active = event.id === selectedId;
          return (
            <li key={event.id} style={{ '--i': index } as React.CSSProperties} className="rise">
              <button
                type="button"
                aria-label={`Show detail: ${event.title}`}
                onClick={() => setSelectedId(event.id)}
                className={cn(
                  'inline-flex max-w-full items-center gap-2.5 rounded-pill border px-4 py-2 text-left transition-colors duration-300 ease-[var(--ease-out-expo)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                  active
                    ? 'border-accent bg-muted text-accent'
                    : 'border-border text-foreground hover:border-accent/40',
                )}
              >
                <span className="tabular shrink-0 font-mono text-[0.6875rem] uppercase tracking-[0.1em] text-muted-foreground">
                  {dateFormatter.format(event.eventDate)}
                </span>
                <span className="max-w-[16rem] truncate text-sm font-medium">{event.title}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <EventDetailDialog
        open={Boolean(selected)}
        onOpenChange={(next) => !next && setSelectedId(null)}
        event={selected}
      />
    </div>
  );
}
