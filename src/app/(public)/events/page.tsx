import type { Metadata } from 'next';
import { EventList, getEventService, PastEventList, splitByTiming } from '@/modules/events';
import { EmptyState } from '@/modules/shared/ui/empty-state';
import { PageHeading } from '@/modules/shared/ui/page-heading';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Events',
    description: 'Upcoming and past talks, workshops and visits.',
  };
}

export default async function EventsPage() {
  const result = await getEventService().list();
  // Upcoming vs past is decided here, against the clock at render time — the database stores only
  // the date. The route's 300s revalidate ceiling bounds how long a page can keep claiming an
  // event is upcoming after it has passed.
  const { upcoming, past } = splitByTiming(result.ok ? result.data : []);
  const isEmpty = upcoming.length === 0 && past.length === 0;

  return (
    <div>
      <PageHeading title="Events" />

      {isEmpty ? (
        <EmptyState title="Nothing listed yet" className="mt-10" />
      ) : (
        <div className="mt-12 space-y-14">
          {/* Both sections are labelled even when only one has content: "Upcoming" with nothing
              under it is a real answer to the question a visitor came with, and silently showing
              only past events would read as if those were the next ones. */}
          <section aria-labelledby="events-upcoming-heading">
            <h2
              id="events-upcoming-heading"
              className="font-mono text-xs uppercase leading-5 tracking-[0.12em] text-accent"
            >
              Upcoming
            </h2>
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
              <h2
                id="events-past-heading"
                className="font-mono text-xs uppercase leading-5 tracking-[0.12em] text-muted-foreground"
              >
                Past
              </h2>
              <div className="mt-5">
                <PastEventList events={past} />
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
