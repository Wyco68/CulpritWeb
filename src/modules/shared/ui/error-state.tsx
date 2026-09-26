import type { ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import { cn } from '@/modules/shared/lib/utils';

// The "this failed" counterpart to EmptyState. The two must never be confused: an empty list is a
// true answer ("no publications yet"), a failed read is not, and showing the first when the second
// happened tells a visitor something false about the lab.
//
// `role="alert"` because, unlike an empty state, this usually replaces content the reader was
// waiting for. Icon + title + text: the state is never carried by colour alone.

export interface ErrorStateProps {
  title: string;
  description?: string;
  /** The way forward — typically "Try again". */
  action?: ReactNode;
  className?: string;
}

export function ErrorState({ title, description, action, className }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-start gap-2 rounded-lg border border-destructive/25 bg-destructive-tint px-7 py-10',
        className,
      )}
    >
      <CircleAlert className="mb-1 size-5 text-destructive" aria-hidden="true" />
      <p className="font-serif text-lg text-foreground">{title}</p>
      {description && (
        <p className="max-w-[58ch] text-pretty text-sm leading-relaxed text-foreground/80">
          {description}
        </p>
      )}
      {action && <div className="mt-3 flex flex-wrap gap-3">{action}</div>}
    </div>
  );
}
