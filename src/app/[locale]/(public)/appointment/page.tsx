import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CalendlyEmbed, getCalendlyService } from '@/modules/integrations';
import { publicEnv } from '@/modules/shared/lib/env';

// Calendly-embed ONLY (explicit client instruction: "calendly only accessible by widget embedded,
// no form"). The free-form request path (FR-7/FR-8's `pending` request → POST /api/appointments)
// stays server-side and untouched, just not wired to any UI here. Direct bookings made through the
// widget are recorded server-side by the existing webhook receiver — this page never calls
// POST /api/appointments/direct itself.

// Per Calendly's "display the scheduling page for users of your app" guide: prefer the live
// `scheduling_url` from GET /event_types (the specific 30-min event, step 3 of the guide) over the
// bare user landing page from GET /users/me (step 1) — the landing page lists every event type and
// is more prone to widget-init issues for a single-event inline embed. Falls back to the configured
// env URL when the API isn't reachable/configured (dev, missing token, rate limit) so the page never breaks.
async function resolveSchedulingUrl(): Promise<string | undefined> {
  const service = getCalendlyService();

  const eventTypes = await service.getEventTypes();
  if (eventTypes.ok && eventTypes.data[0]?.schedulingUrl) return eventTypes.data[0].schedulingUrl;

  const currentUser = await service.getCurrentUser();
  if (currentUser.ok && currentUser.data.schedulingUrl) return currentUser.data.schedulingUrl;

  return publicEnv.calendlyUrl || undefined;
}

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'appointment' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

export default async function AppointmentPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('appointment');
  const schedulingUrl = await resolveSchedulingUrl();

  return (
    <div>
      <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{t('title')}</h2>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">{t('subtitle')}</p>

      {/* Widen past the article column: Calendly's calendar grid is cramped in a narrow column. */}
      <div className="-mx-6 mt-8 sm:mx-0">
        <div className="mx-auto max-w-5xl px-6 sm:px-0">
          <CalendlyEmbed url={schedulingUrl} minHeight={900} />
        </div>
      </div>
    </div>
  );
}
