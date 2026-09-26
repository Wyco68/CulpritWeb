'use client';

import { useState } from 'react';
import { ArrowRight, Images, PlayCircle, Users, type LucideIcon } from 'lucide-react';
import { Button } from '@/modules/shared/ui/button';
import { CardPhoto } from '@/modules/shared/ui/card-photo';
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

/** One media count on a card: an icon, the number, and the noun for assistive tech. */
type Extra = { icon: LucideIcon; count: number; noun: string };

export function EventList({ events }: { events: Event[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  // Read from `events` rather than holding the event object, so a refresh can't leave the dialog
  // showing a stale copy.
  const open = events.find((event) => event.id === openId);

  return (
    <>
      <ul className="grid gap-5 @xl:grid-cols-2 @4xl:grid-cols-3">
        {events.map((event, index) => {
          // Counts shown as icon + number (the noun is read out, not printed), in place of a
          // "2 photos · 1 video · 6 participants" string. Zero counts are left out.
          const extras: Extra[] = [
            { icon: Images, count: event.photoUrls.length, noun: 'photo' },
            { icon: PlayCircle, count: event.videoUrls.length, noun: 'video' },
            { icon: Users, count: event.participants.length, noun: 'participant' },
          ].filter((extra) => extra.count > 0);

          return (
            <li
              key={event.id}
              style={{ '--i': index } as React.CSSProperties}
              className="rise flex h-full min-w-0 flex-col overflow-hidden rounded-lg border border-border-strong bg-surface shadow-hairline"
            >
              <CardPhoto src={event.photoUrls[0]} />

              <div className="flex flex-1 flex-col p-6">
                <p className="tabular text-sm text-muted-foreground">
                  <time dateTime={event.eventDate.toISOString()}>
                    {dateFormatter.format(event.eventDate)} at{' '}
                    <span className="font-medium text-foreground">
                      {timeFormatter.format(event.eventDate)}
                    </span>
                  </time>
                </p>

                <h3 className="mt-2 text-balance break-words font-serif text-xl leading-snug text-foreground">
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
                    <ul className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                      {extras.map(({ icon: Icon, count, noun }) => (
                        <li key={noun} className="inline-flex items-center gap-1">
                          <Icon className="size-4" aria-hidden="true" />
                          <span className="tabular">{count}</span>
                          <span className="sr-only">
                            {' '}
                            {noun}
                            {count === 1 ? '' : 's'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span />
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={`Show Details: ${event.title}`}
                    onClick={() => setOpenId(event.id)}
                  >
                    Show Details
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Button>
                </div>
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
