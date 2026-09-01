import { Ban, CalendarCheck2 } from 'lucide-react';
import { cn } from '@/modules/shared/lib/utils';

// The one canonical appointment-status marker, reused everywhere the lifecycle is shown (public
// Upcoming Events, admin Manage Appointments). Status is conveyed by icon + text label, never
// colour alone (WCAG 2.1 AA §1.4.1, "use of colour").
//
// Only two states exist: every appointment is admin-declared, so there is nothing to be pending,
// approved, declined, or booked — it is either `scheduled` or `cancelled`.
//
// Deliberately drops the emerald/slate palette it used to carry. Emerald was a second accent in a
// design that has exactly one, and it came with a `dark:` variant for a dark mode this site does
// not have and will not get. The distinction is now carried by the design's own tokens: an
// active item marked in the accent, an inactive one receded into the muted foreground.

export type AppointmentStatus = 'scheduled' | 'cancelled';

const STATUS_STYLES: Record<
  AppointmentStatus,
  { icon: typeof CalendarCheck2; dot: string; text: string; label: string }
> = {
  scheduled: {
    icon: CalendarCheck2,
    dot: 'bg-accent',
    text: 'text-foreground',
    label: 'Scheduled',
  },
  cancelled: {
    icon: Ban,
    // Hollow rather than filled — an outline reads as "no longer live" before the label is read.
    dot: 'bg-transparent ring-1 ring-current',
    text: 'text-muted-foreground',
    label: 'Cancelled',
  },
};

export interface StatusPillProps {
  status: AppointmentStatus;
  className?: string;
}

export function StatusPill({ status, className }: StatusPillProps) {
  const { icon: Icon, dot, text, label } = STATUS_STYLES[status];

  return (
    <span
      className={cn(
        // Squared, not a rounded pill: the pill badge is the single most recognisable stock
        // component shape on the web, and a tighter radius sits inside this design's radius scale.
        'inline-flex items-center gap-1.5 rounded-xs border border-border bg-muted px-2 py-1 text-xs font-medium',
        text,
        className,
      )}
    >
      <span className={cn('size-1.5 shrink-0 rounded-full', dot)} aria-hidden="true" />
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      {label}
    </span>
  );
}
