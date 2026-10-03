'use client';

import { useId, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { TurnstileWidget } from '@/modules/integrations/turnstile/turnstile-widget';
import { cn } from '@/modules/shared/lib/utils';

// The Turnstile check in front of the password-reset request (ADR-022), presented as a labelled
// group with a text status. The widget is a cross-origin iframe this app can't label itself, so
// the group's label and the status line carry the context for a screen reader, and the status
// line doubles as the explanation of why the submit button is still disabled (`statusId`).
//
// Each token is single-use. The caller remounts this component (a new `key`) after spending one;
// that starts a fresh check and resets the status here.

export interface HumanCheckProps {
  siteKey: string;
  /** A fresh token, or null when the last one expired or the check failed. */
  onTokenChange: (token: string | null) => void;
  /** id of the status line, for the submit button's `aria-describedby`. */
  statusId: string;
  /** Status while no token is held, e.g. "Complete the check to send a code." */
  waitingText: string;
  className?: string;
}

type CheckState = 'waiting' | 'done' | 'failed';

export function HumanCheck({
  siteKey,
  onTokenChange,
  statusId,
  waitingText,
  className,
}: HumanCheckProps) {
  const [state, setState] = useState<CheckState>('waiting');
  const labelId = useId();

  const status =
    state === 'done'
      ? 'Check complete.'
      : state === 'failed'
        ? "The check couldn't finish. Reload the page and try again."
        : waitingText;

  return (
    <div
      role="group"
      aria-labelledby={labelId}
      className={cn(
        'flex flex-col gap-2 rounded-md border border-border bg-muted/40 p-3',
        className,
      )}
    >
      <p id={labelId} className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <ShieldCheck className="size-4 text-accent" aria-hidden="true" />
        Human check
      </p>
      <TurnstileWidget
        siteKey={siteKey}
        onToken={(token) => {
          setState('done');
          onTokenChange(token);
        }}
        onExpire={() => {
          setState('waiting');
          onTokenChange(null);
        }}
        onError={() => {
          setState('failed');
          onTokenChange(null);
        }}
      />
      <p
        id={statusId}
        role="status"
        aria-live="polite"
        className={cn(
          'text-xs',
          state === 'failed' ? 'font-medium text-destructive' : 'text-muted-foreground',
        )}
      >
        {status}
      </p>
    </div>
  );
}
