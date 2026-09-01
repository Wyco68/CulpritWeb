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
  //
  // Split into date and time so the date can hold the left rail as a running head, the same
  // shape the Research index and Publications list use.
  const dateFormatter = new Intl.DateTimeFormat('en', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: INSTITUTION_TIME_ZONE,
  });
  const timeFormatter = new Intl.DateTimeFormat('en', {
    timeStyle: 'short',
    timeZone: INSTITUTION_TIME_ZONE,
  });

  return (
    <ul className="border-t border-border">
      {events.map((event, index) => (
        <li
          key={event.id}
          style={{ '--i': index } as React.CSSProperties}
          className="rise grid gap-x-8 gap-y-3 border-b border-border py-6 sm:grid-cols-[9rem_1fr] sm:items-baseline"
        >
          <p className="tabular font-mono text-xs uppercase leading-5 tracking-[0.12em] text-muted-foreground">
            <time dateTime={event.scheduledAt.toISOString()}>
              {dateFormatter.format(event.scheduledAt)}
              <span className="sr-only"> at </span>
              <span className="mt-0.5 block text-foreground">
                {timeFormatter.format(event.scheduledAt)}
              </span>
            </time>
          </p>

          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <div className="min-w-0">
              <p className="font-serif text-lg text-foreground">{event.requesterName}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {event.researchGroup ?? 'No research group specified'}
              </p>
            </div>
            <StatusPill status={event.status} />
          </div>
        </li>
      ))}
    </ul>
  );
}
