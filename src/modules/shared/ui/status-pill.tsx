import { Ban, CalendarCheck2, CircleCheck, Clock3, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/modules/shared/lib/utils';

// The one canonical appointment-status pill, reused everywhere the lifecycle is shown (public
// Upcoming Events today; admin Manage Appointments later). Status is conveyed by icon + text
// label, never color alone (WCAG 2.1 AA — "use of color"). Works in Server Components too:
// next-intl's `useTranslations` is dual server/client since v3.

export type AppointmentStatus = 'pending' | 'approved' | 'booked' | 'declined' | 'cancelled';

const STATUS_STYLES: Record<
  AppointmentStatus,
  { icon: typeof Clock3; dot: string; text: string }
> = {
  pending: { icon: Clock3, dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400' },
  approved: { icon: CircleCheck, dot: 'bg-sky-500', text: 'text-sky-700 dark:text-sky-400' },
  booked: {
    icon: CalendarCheck2,
    dot: 'bg-emerald-500',
    text: 'text-emerald-700 dark:text-emerald-400',
  },
  declined: { icon: XCircle, dot: 'bg-rose-500', text: 'text-rose-700 dark:text-rose-400' },
  cancelled: { icon: Ban, dot: 'bg-slate-400', text: 'text-muted-foreground' },
};

export interface StatusPillProps {
  status: AppointmentStatus;
  className?: string;
}

export function StatusPill({ status, className }: StatusPillProps) {
  const t = useTranslations('appointments.status');
  const { icon: Icon, dot, text } = STATUS_STYLES[status];

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
      {t(status)}
    </span>
  );
}
