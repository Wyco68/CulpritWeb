'use client';

import { useEffect, useState } from 'react';
import { EmptyState } from '@/modules/shared/ui/empty-state';
import { SectionHeading } from '@/modules/shared/ui/prose';
import { splitByTiming } from '../event-timing';
import type { Event } from '../event.types';
import { EventList } from './event-list';

// The Upcoming and Past halves of the public events page, split against the VISITOR's clock.
//
// The split used to happen on the server at prerender time, which forced the page to regenerate
// every five minutes so an event could not claim to be upcoming for long after it had passed —
// about 8,600 regenerations a month for a list that changes a few times a year. Now the prerender
// uses its own clock (so the HTML and the first client render agree, with no hydration mismatch),
// and the browser re-splits on mount. The page can then be cached like every other public page;
// admin edits still reach it at once through `revalidatePath('/events')`.

export function EventTimeline({ events, renderedAt }: { events: Event[]; renderedAt: number }) {
  const [now, setNow] = useState(renderedAt);
  useEffect(() => setNow(Date.now()), []);

  const { upcoming, past } = splitByTiming(events, new Date(now));

  return (
    <>
      {/* Both sections are labelled even when only one has content: "Upcoming" with nothing under
          it is a real answer to the question a visitor came with, and silently showing only past
          events would read as if those were the next ones. */}
      <section aria-labelledby="events-upcoming-heading">
        <SectionHeading id="events-upcoming-heading">Upcoming</SectionHeading>
        {upcoming.length === 0 ? (
          <EmptyState title="Nothing scheduled" className="mt-5" />
        ) : (
          <div className="mt-5">
            <EventList events={upcoming} />
          </div>
        )}
      </section>

      {past.length > 0 && (
        <section aria-labelledby="events-past-heading">
          <SectionHeading id="events-past-heading" className="text-muted-foreground">
            Past
          </SectionHeading>
          <div className="mt-5">
            <EventList events={past} />
          </div>
        </section>
      )}
    </>
  );
}
