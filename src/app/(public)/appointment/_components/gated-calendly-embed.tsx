'use client';

import { useState } from 'react';
// Deep, concrete-file imports rather than the `@/modules/integrations` barrel: the barrel also
// re-exports `getTurnstileVerifier`, which imports `env.server.ts` (guarded by `server-only`) —
// even an unused named import from the barrel drags that into this Client Component's bundle and
// fails the build. Same reasoning as the admin form dialogs' deep imports elsewhere.
import { CalendlyEmbed, type CalendlyEmbedProps } from '@/modules/integrations/calendly/calendly-embed';
import { TurnstileChallenge } from '@/modules/integrations/turnstile/turnstile-challenge';

/**
 * Gates the Calendly embed behind a Turnstile human-check. Calendly's Free plan has no bot
 * protection of its own and allows only one bookable event type, so an unprotected embed lets a
 * script fill the professor's entire real calendar (see turnstile-challenge.tsx for the full
 * rationale). Most visitors clear the check in under a second; the widget only mounts after.
 */
export function GatedCalendlyEmbed(props: CalendlyEmbedProps) {
  const [verified, setVerified] = useState(false);

  if (!verified) {
    return <TurnstileChallenge onVerified={() => setVerified(true)} />;
  }

  return <CalendlyEmbed {...props} />;
}
