import type { Metadata } from 'next';
import { CalendarClock } from 'lucide-react';
import {
  getUpcomingEventsService,
  toAppointmentView,
  UpcomingEventsList,
} from '@/modules/appointments';
import { EmptyState } from '@/modules/shared/ui/empty-state';

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
      <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Upcoming Events</h2>

      {events.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No upcoming events"
          description="There are no scheduled meetings at this time."
          className="mt-6"
        />
      ) : (
        <div className="mt-6">
          <UpcomingEventsList events={events} />
        </div>
      )}
    </div>
  );
}
