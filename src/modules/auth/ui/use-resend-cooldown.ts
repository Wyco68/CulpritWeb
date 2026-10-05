'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Seconds a "Resend code" button waits after a send. Per IP the server allows 5 two-factor sends and
 * 3 reset requests per 10 minutes (ADR-022); this only paces honest retries well inside both.
 */
export const RESEND_COOLDOWN_SECONDS = 45;

/**
 * A countdown for a "Resend code" button. `start()` after every successful send; `remaining` is
 * the whole seconds left (0 when a resend is allowed). `startActive` begins the wait on mount, for
 * a step that is entered right after a code was sent. It ticks from a deadline rather than counting
 * intervals, so a throttled background tab doesn't stretch the wait.
 */
export function useResendCooldown({
  seconds = RESEND_COOLDOWN_SECONDS,
  startActive = false,
}: { seconds?: number; startActive?: boolean } = {}) {
  const [deadline, setDeadline] = useState<number | null>(() =>
    startActive ? Date.now() + seconds * 1000 : null,
  );
  const [remaining, setRemaining] = useState(startActive ? seconds : 0);

  const start = useCallback(() => {
    setDeadline(Date.now() + seconds * 1000);
    setRemaining(seconds);
  }, [seconds]);

  useEffect(() => {
    if (deadline === null) return;
    const id = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) setDeadline(null);
    }, 1000);
    return () => window.clearInterval(id);
  }, [deadline]);

  return { remaining, start };
}
