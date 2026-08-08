import type { Metadata } from 'next';
import { CalendarClock, EyeOff } from 'lucide-react';
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
  // Never 404/hide the tab itself — render an explicit disabled state when the admin has the
  // visibility setting off, per FR-5 and the upcoming-events service contract.
  const visible = result.ok && result.data.visible;
  const events = result.ok ? result.data.events.map(toAppointmentView) : [];

  return (
    <div>
      <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Upcoming Events</h2>

      {!result.ok || !visible ? (
        <EmptyState
          icon={EyeOff}
          title="Upcoming events aren't shown right now"
          description="The admin hasn't made this section public yet. Please check back soon."
          className="mt-6"
        />
      ) : events.length === 0 ? (
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
