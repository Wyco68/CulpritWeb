import type { Metadata } from 'next';
import {
  getUpcomingEventsService,
  toAppointmentView,
  UpcomingEventsList,
} from '@/modules/appointments';
import { EmptyState } from '@/modules/shared/ui/empty-state';
import { PageHeading } from '@/modules/shared/ui/page-heading';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Upcoming Events',
    description: 'Upcoming meetings and the research groups due to meet.',
  };
}

export default async function EventsPage() {
  const result = await getUpcomingEventsService().getUpcomingEvents();
  // Visibility is per-appointment (`isPublic`, admin-toggled) — the query already only returns
  // rows the admin opted in, so there is no separate "section disabled" state to render anymore.
  const events = result.ok ? result.data.events.map(toAppointmentView) : [];

  return (
    <div>
      <PageHeading title="Upcoming Events" />

      {events.length === 0 ? (
        <EmptyState title="Nothing scheduled" className="mt-10" />
      ) : (
        <div className="mt-12">
          <UpcomingEventsList events={events} />
        </div>
      )}
    </div>
  );
}
