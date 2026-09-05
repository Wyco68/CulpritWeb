'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Script from 'next/script';
import { ShieldCheck } from 'lucide-react';
import { apiSend } from '@/modules/shared/lib/api-client';
import { publicEnv } from '@/modules/shared/lib/env';
import { cn } from '@/modules/shared/lib/utils';

const TURNSTILE_WIDGET_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

type TurnstileGlobal = {
  render: (
    container: HTMLElement,
    options: { sitekey: string; callback: (token: string) => void; 'error-callback'?: () => void },
  ) => string;
};

declare global {
  interface Window {
    turnstile?: TurnstileGlobal;
  }
}

export interface TurnstileChallengeProps {
  /** Called once the visitor passes the challenge AND the server has confirmed the token. */
  onVerified: () => void;
  className?: string;
}

/**
 * A standalone human-check gate — not tied to any form submission. Used in front of the Calendly
 * embed (see `src/app/(public)/appointment/_components/gated-calendly-embed.tsx`): Calendly's
 * Free plan has no bot protection of its own and only one bookable event type, so an unprotected
 * embed lets a script fill the professor's entire real calendar. This shows a brief "are you
 * human?" check and only reveals `children` (via `onVerified`) once Cloudflare's own siteverify
 * confirms the token server-side — the client widget alone proves nothing (see
 * turnstile-verifier.ts's own header comment).
 *
 * Skips itself when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is unset (dev/test without Cloudflare
 * configured) so local work is never blocked.
 */
export function TurnstileChallenge({ onVerified, className }: TurnstileChallengeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [verifying, setVerifying] = useState(false);
  const [failed, setFailed] = useState(false);
  const rendered = useRef(false);
  const regionLabelId = useId();

  const siteKey = publicEnv.turnstileSiteKey;

  useEffect(() => {
    if (!siteKey) onVerified();
    // `onVerified` intentionally omitted: it's a parent-supplied callback (typically an inline
    // `setState`), not a value this effect should re-run for — only `siteKey` (static per env)
    // decides whether to skip.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey]);

  if (!siteKey) return null;

  async function handleToken(token: string) {
    setVerifying(true);
    setFailed(false);
    try {
      // A rejected verification and a network failure are the same thing to the visitor: the
      // challenge did not pass, so try again. `apiSend` turns the former into a throw, which is
      // why both land in the one catch.
      await apiSend('POST', '/api/turnstile/verify', { token });
      onVerified();
    } catch {
      setFailed(true);
    } finally {
      setVerifying(false);
    }
  }

  function renderWidget() {
    const container = containerRef.current;
    if (!container || rendered.current || !window.turnstile) return;
    rendered.current = true;
    window.turnstile.render(container, {
      sitekey: siteKey,
      callback: (token) => void handleToken(token),
      'error-callback': () => setFailed(true),
    });
  }

  return (
    <section
      aria-labelledby={regionLabelId}
      className={cn(
        'flex flex-col items-center gap-3 rounded-lg border border-border bg-muted/30 px-6 py-10 text-center',
        className,
      )}
    >
      <ShieldCheck className="size-6 text-accent" aria-hidden="true" />
      <h2 id={regionLabelId} className="text-sm font-medium text-foreground">
        Confirming you&apos;re not a bot before loading the scheduling calendar…
      </h2>
      <div ref={containerRef} />
      {verifying && <p className="text-xs text-muted-foreground">Checking…</p>}
      {failed && (
        <p role="alert" className="text-xs font-medium text-destructive">
          Verification failed. Please try again.
        </p>
      )}
      <Script src={TURNSTILE_WIDGET_SRC} strategy="afterInteractive" onReady={renderWidget} />
    </section>
  );
}
