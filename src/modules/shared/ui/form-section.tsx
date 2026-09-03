import * as React from 'react';
import { cn } from '@/modules/shared/lib/utils';

// A titled, ruled group of form fields. The profile form is the longest screen in the app — eight
// basic fields followed by seven repeatable CV lists — and it previously ran as one flat column of
// identically-weighted boxes, so there was no way to tell where "Education" ended and "Teaching
// roles" began without reading every label.
//
// Each section is announced by a rule, a serif heading and an optional count, which gives the eye
// a fixed landmark to scan for. `<section>` + `aria-labelledby` so the same landmarks exist for
// screen-reader users navigating by region or heading.

export interface FormSectionProps {
  title: string;
  description?: string;
  /** Right-aligned control for the section — typically "Add item". */
  action?: React.ReactNode;
  /** Rendered beside the title, e.g. the number of entries in a list. */
  badge?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function FormSection({
  title,
  description,
  action,
  badge,
  children,
  className,
}: FormSectionProps) {
  const headingId = React.useId();

  return (
    <section aria-labelledby={headingId} className={cn('border-t border-border pt-7', className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-baseline gap-3">
            <h2 id={headingId} className="font-serif text-2xl text-foreground">
              {title}
            </h2>
            {badge}
          </div>
          {description && (
            <p className="mt-2 max-w-[62ch] text-pretty text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>

      <div className="mt-6">{children}</div>
    </section>
  );
}

/** The entry count shown beside a list section's title. */
export function FormSectionCount({ count }: { count: number }) {
  return (
    <span className="tabular shrink-0 font-mono text-xs text-muted-foreground">
      {count} {count === 1 ? 'entry' : 'entries'}
    </span>
  );
}
