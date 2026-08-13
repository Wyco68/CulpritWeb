import { StatusPill } from '@/modules/shared/ui/status-pill';
import { INSTITUTION_TIME_ZONE } from '@/modules/shared/lib/timezone';
import type { AppointmentView } from '@/modules/appointments';

// Renders the fields the spec's Privacy section (§6) allows publicly: requester name, research
// group, and time. Every event here is admin-declared and already filtered to `scheduled` by the
// upcoming-events service, so the status pill is mostly decorative — kept for visual consistency
// with the admin table rather than dropped.
export function UpcomingEventsList({ events }: { events: AppointmentView[] }) {
  // This is a Server Component — without an explicit `timeZone`, `Intl.DateTimeFormat` resolves
  // to the rendering server's ambient zone (e.g. UTC in the Docker container), not the visitor's
  // and not the zone the admin actually scheduled in. Pin it so every visitor sees the same,
  // correct wall-clock time regardless of where the page happens to render.
  const timeFormatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: INSTITUTION_TIME_ZONE,
  });

  return (
    <ul className="divide-y divide-border border-t border-border">
      {events.map((event) => (
        <li key={event.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="min-w-0">
            <p className="font-medium text-foreground">{event.requesterName}</p>
            <p className="text-sm text-muted-foreground">
              {event.researchGroup ?? 'No research group specified'}
              {' · '}
              {timeFormatter.format(event.scheduledAt)}
            </p>
          </div>
          <StatusPill status={event.status} />
        </li>
      ))}
    </ul>
  );
}
