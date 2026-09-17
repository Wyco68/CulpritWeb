import { CheckCircle2, CircleAlert, CircleMinus, type LucideIcon } from 'lucide-react';
import { cn } from '@/modules/shared/lib/utils';

// A row's derived state in an admin table — always icon AND label, so it reads the same without
// colour (WCAG 1.4.1, and for colour-blind admins). The three tones also differ in shape: a solid
// check, an alert ring on a bordered pill, and a quiet dash on a filled one.
//
// Nothing here is stored. Every status is computed from fields the row already has (a date, a
// missing link, a team that no longer shows the list) — the project has no status columns.

export type StatusTone = 'ok' | 'attention' | 'neutral';

export type Status = { tone: StatusTone; label: string; icon?: LucideIcon };

const TONES: Record<StatusTone, { icon: LucideIcon; className: string }> = {
  ok: { icon: CheckCircle2, className: 'border-accent/30 bg-accent/10 text-accent' },
  attention: { icon: CircleAlert, className: 'border-foreground/35 bg-surface text-foreground' },
  neutral: { icon: CircleMinus, className: 'border-transparent bg-muted text-muted-foreground' },
};

export function StatusPill({ status, className }: { status: Status; className?: string }) {
  const tone = TONES[status.tone];
  const Icon = status.icon ?? tone.icon;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill border px-2.5 py-0.5 text-xs font-medium',
        tone.className,
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      {status.label}
    </span>
  );
}
