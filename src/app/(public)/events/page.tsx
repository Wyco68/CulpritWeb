import type { Metadata } from 'next';
import { EventTimeline, getEventService } from '@/modules/events';
import { getProfileCached } from '@/modules/profile';
import { EmptyState } from '@/modules/shared/ui/empty-state';
import { LoadErrorState } from '@/modules/shared/ui/error-state';
import { PageHeading } from '@/modules/shared/ui/page-heading';
import { Standfirst } from '@/modules/shared/ui/prose';
import { toMetaDescription } from '../_lib/page-meta';

// No `revalidate` of its own: it takes the public layout's safety net like every other public page.
// It used to be 300s, because the upcoming/past split ran against the prerender's clock; the split
// now runs in the browser (EventTimeline), and admin edits purge the page on demand.

const FALLBACK_DESCRIPTION = 'Upcoming and past talks, workshops and visits.';

export async function generateMetadata(): Promise<Metadata> {
  const profileResult = await getProfileCached();
  return {
    title: 'Events',
    description: toMetaDescription(
      profileResult.ok ? profileResult.data?.eventsIntro : null,
      FALLBACK_DESCRIPTION,
    ),
  };
}

export default async function EventsPage() {
  // The profile read is the layout's, deduplicated per request — it is here only for the intro.
  const [result, profileResult] = await Promise.all([getEventService().list(), getProfileCached()]);
  const intro = profileResult.ok ? profileResult.data?.eventsIntro : null;
  // Upcoming vs past is split in the browser, against the visitor's clock — see EventTimeline.
  const events = result.ok ? result.data : [];
  const isEmpty = events.length === 0;

  return (
    <div>
      <PageHeading title="Events" />

      <div className="mt-12 space-y-14">
        {intro && <Standfirst>{intro}</Standfirst>}

        {!result.ok ? (
          <LoadErrorState what="Events" />
        ) : isEmpty ? (
          <EmptyState title="Nothing listed yet" />
        ) : (
          <EventTimeline events={events} renderedAt={Date.now()} />
        )}
      </div>
    </div>
  );
}
