'use client';

import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/modules/shared/ui/button';
import { panelClassName } from '@/modules/shared/ui/card';
import { dateFormatter, timeFormatter } from './event-media';
import { EventDetailDialog } from './event-detail-dialog';
import type { Event } from '../event.types';

// Upcoming events, one card each. A client island only because of the detail dialog — the cards
// themselves are static.
//
// Each card carries a fixed set of fields: date, title, a clamped summary, and a count of what is
// inside. Photos, the full write-up and the participant list all moved into the dialog, because
// rendering them inline made every card as tall as its own content and turned the list into a
// ragged column. `h-full` on the card plus a fixed summary clamp keeps them uniform.

export function EventList({ events }: { events: Event[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  // Read from `events` rather than holding the event object, so a refresh can't leave the dialog
  // showing a stale copy.
  const open = events.find((event) => event.id === openId);

  return (
    <>
      <ul className="grid gap-5 sm:grid-cols-2">
        {events.map((event, index) => {
          const extras = [
            event.photoUrls.length > 0 && `${event.photoUrls.length} photos`,
            event.videoUrls.length > 0 && `${event.videoUrls.length} videos`,
            event.participants.length > 0 && `${event.participants.length} participants`,
          ].filter(Boolean) as string[];

          return (
            <li
              key={event.id}
              style={{ '--i': index } as React.CSSProperties}
              className={`rise flex h-full flex-col ${panelClassName}`}
            >
              <p className="tabular font-mono text-xs uppercase leading-5 tracking-[0.12em] text-muted-foreground">
                <time dateTime={event.eventDate.toISOString()}>
                  {dateFormatter.format(event.eventDate)}
                  <span className="sr-only"> at </span>
                  <span className="ml-2 text-foreground">
                    {timeFormatter.format(event.eventDate)}
                  </span>
                </time>
              </p>

              <h3 className="mt-3 text-balance font-serif text-xl leading-snug text-foreground sm:text-2xl">
                {event.title}
              </h3>

              {/* Clamped to three lines so a long summary cannot stretch one card past its
                  neighbours. The full text is a click away. */}
              <p className="mt-2 line-clamp-3 text-pretty leading-[1.7] text-muted-foreground">
                {event.description}
              </p>

              {/* `mt-auto` pins the footer to the bottom of whichever card is tallest, so the
                  buttons line up across the row instead of floating under their own text. */}
              <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
                {extras.length > 0 ? (
                  <p className="font-mono text-xs text-muted-foreground">{extras.join(' · ')}</p>
                ) : (
                  <span />
                )}
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={`Show detail: ${event.title}`}
                  onClick={() => setOpenId(event.id)}
                >
                  Show detail
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <EventDetailDialog
        open={Boolean(open)}
        onOpenChange={(next) => !next && setOpenId(null)}
        event={open}
      />
    </>
  );
}
