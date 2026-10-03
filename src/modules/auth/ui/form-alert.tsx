import type * as React from 'react';
import { CircleAlert, MailCheck } from 'lucide-react';
import { cn } from '@/modules/shared/lib/utils';

// The two message boxes the sign-in, reset and security forms share. Icon plus text, so the kind of
// message never rests on colour alone.

/** A failed submit. `role="alert"`, so it is announced the moment it appears. */
export function FormAlert({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        'flex items-start gap-2.5 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive',
        className,
      )}
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

/**
 * Neutral progress news ("a new code is on its way"). The polite live region is always rendered
 * and only its content changes: a region inserted together with its text is often not announced.
 */
export function FormNotice({ message, className }: { message: string | null; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={cn(!message && 'sr-only')}>
      {message && (
        <div
          className={cn(
            'flex items-start gap-2.5 rounded-md border border-border-strong bg-muted px-3 py-2 text-sm text-foreground',
            className,
          )}
        >
          <MailCheck className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
          <span>{message}</span>
        </div>
      )}
    </div>
  );
}
