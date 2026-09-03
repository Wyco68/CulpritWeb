'use client';

import { useId, useState } from 'react';
import { cn } from '@/modules/shared/lib/utils';
import { dateFormatter, EventMedia, timeFormatter } from './event-media';
import type { Event } from '../event.types';

/**
 * Past events: a wrapped row of compact date+title buttons rather than the Upcoming tab's full
 * cards — a past event is scannable-first, and a growing archive of full cards would dominate the
 * page. Selecting a button opens one shared detail panel below the row (not per-button inline, so
 * the row itself never reflows). Client island: the only state on the whole Events tab.
 */
export function PastEventList({ events }: { events: Event[] }) {
  const detailId = useId();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = events.find((event) => event.id === selectedId) ?? null;

  return (
    <div>
      <ul className="flex flex-wrap gap-2.5">
        {events.map((event, index) => {
          const active = event.id === selectedId;
          return (
            <li key={event.id} style={{ '--i': index } as React.CSSProperties} className="rise">
              <button
                type="button"
                aria-expanded={active}
                aria-controls={detailId}
                onClick={() => setSelectedId(active ? null : event.id)}
                className={cn(
                  'inline-flex max-w-full items-center gap-2.5 rounded-full border px-4 py-2 text-left transition-colors duration-300 ease-[var(--ease-out-expo)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
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

      {selected && (
        <div
          id={detailId}
          className="mt-5 rounded-[10px] border border-border bg-background p-6 shadow-hairline sm:p-8"
        >
          <p className="tabular font-mono text-xs uppercase leading-5 tracking-[0.12em] text-muted-foreground">
            <time dateTime={selected.eventDate.toISOString()}>
              {dateFormatter.format(selected.eventDate)}
              <span className="sr-only"> at </span>
              {timeFormatter.format(selected.eventDate)}
            </time>
          </p>
          <h4 className="mt-2 text-balance font-serif text-xl leading-snug text-foreground sm:text-2xl">
            {selected.title}
          </h4>
          <p className="mt-3 max-w-[62ch] whitespace-pre-line text-pretty leading-[1.7] text-muted-foreground">
            {selected.description}
          </p>
          <EventMedia event={selected} />
        </div>
      )}
    </div>
  );
}
