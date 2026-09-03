import type { LucideIcon } from 'lucide-react';
import { cn } from '@/modules/shared/lib/utils';

// Reusable "nothing here yet" panel — used for empty lists (no research yet, no publications yet)
// and for the not-found page.
//
// Two deliberate changes from the earlier version:
//
// 1. No `role="status"`. This is static, server-rendered content that is present on first paint,
//    not a live region that updates — announcing it as a status message is a misuse of the role
//    and interrupts screen-reader users for something the document already says.
// 2. The icon is optional and left off on the public tabs. A flask for research, a compass for a
//    404 and a magnifying glass for a search are decorative metaphors that carry no information
//    the sentence beneath them doesn't already carry. The admin tables keep theirs, where a dense
//    working screen benefits from a non-text landmark.
//
// Left-aligned rather than centred: it sits in a reading column, and centred body copy in a
// left-aligned document reads as a template rather than a considered state.

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-start gap-2 rounded-lg border border-dashed border-border-strong bg-surface px-7 py-12',
        className,
      )}
    >
      {Icon && <Icon className="mb-1 size-5 text-muted-foreground" aria-hidden="true" />}
      <p className="font-serif text-lg text-foreground">{title}</p>
      {description && (
        <p className="max-w-[58ch] text-pretty text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  );
}
