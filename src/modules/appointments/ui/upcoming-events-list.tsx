import { useTranslations } from 'next-intl';
import { StatusPill } from '@/modules/shared/ui/status-pill';
import type { AppointmentView } from '@/modules/appointments';

// Renders only the fields the spec's Privacy section (§6) allows publicly: requester name,
// research group, and time. `requesterEmail` exists on `AppointmentView` (it's stripped of the
// cancel token, not of PII) so it is deliberately never read here.
export function UpcomingEventsList({ events }: { events: AppointmentView[] }) {
  const t = useTranslations('events');
  const timeFormatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <ul className="divide-y divide-border border-t border-border">
      {events.map((event) => (
        <li key={event.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="min-w-0">
            <p className="font-medium text-foreground">{event.requesterName}</p>
            <p className="text-sm text-muted-foreground">
              {event.researchGroup ?? t('noResearchGroup')}
              {event.scheduledAt || event.requestedTime ? ' · ' : ''}
              {event.scheduledAt
                ? timeFormatter.format(event.scheduledAt)
                : event.requestedTime
                  ? timeFormatter.format(event.requestedTime)
                  : null}
            </p>
          </div>
          <StatusPill status={event.status} />
        </li>
      ))}
    </ul>
  );
}
