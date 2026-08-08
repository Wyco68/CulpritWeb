import { Ban, CalendarCheck2 } from 'lucide-react';
import { cn } from '@/modules/shared/lib/utils';

// The one canonical appointment-status pill, reused everywhere the lifecycle is shown (public
// Upcoming Events, admin Manage Appointments). Status is conveyed by icon + text label, never
// color alone (WCAG 2.1 AA — "use of color"). Works in Server Components too — plain literal
// strings, no client-only i18n context required.
//
// Only two states exist: every appointment is admin-declared, so there is nothing to be pending,
// approved, declined, or booked — it is either `scheduled` or `cancelled`.

export type AppointmentStatus = 'scheduled' | 'cancelled';

const STATUS_STYLES: Record<
  AppointmentStatus,
  { icon: typeof CalendarCheck2; dot: string; text: string; label: string }
> = {
  scheduled: {
    icon: CalendarCheck2,
    dot: 'bg-emerald-500',
    text: 'text-emerald-700 dark:text-emerald-400',
    label: 'Scheduled',
  },
  cancelled: {
    icon: Ban,
    dot: 'bg-slate-400',
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
        'inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs font-medium',
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
