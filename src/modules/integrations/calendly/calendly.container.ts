import { env } from '@/modules/shared/lib/env.server';
import { getCalendlyLinkStore } from '@/modules/appointments';
import { HttpCalendlyClient } from './calendly.client';
import { createCalendlyService, type CalendlyService } from './calendly.service';

// Composition root for the Calendly REST integration. Reads server-only env, builds the HTTP client
// only when a token is present (otherwise the service reports "not configured"), and injects the
// appointment-domain link store for webhook effects. Route handlers call getCalendlyService() only.
let cached: CalendlyService | undefined;

export function getCalendlyService(): CalendlyService {
  if (!cached) {
    cached = createCalendlyService({
      client: env.CALENDLY_ACCESS_TOKEN ? new HttpCalendlyClient(env.CALENDLY_ACCESS_TOKEN) : undefined,
      linkStore: getCalendlyLinkStore(),
      userUri: env.CALENDLY_USER_URI,
      webhookSigningKey: env.CALENDLY_WEBHOOK_SIGNING_KEY,
      schedulingUrl: process.env.NEXT_PUBLIC_CALENDLY_URL,
    });
  }
  return cached;
}
