import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CalendlyEmbed, getCalendlyService } from '@/modules/integrations';
import { publicEnv } from '@/modules/shared/lib/env';

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
  const t = await getTranslations({ locale, namespace: 'appointment' });
  const schedulingUrl = await resolveSchedulingUrl();

  return (
    <main className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
      <p className="font-mono text-sm uppercase tracking-widest text-accent">{t('eyebrow')}</p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{t('title')}</h1>
      <p className="mt-4 max-w-xl text-lg text-muted-foreground">{t('subtitle')}</p>

      <section className="mt-12" aria-labelledby="book-directly-heading">
        <h2 id="book-directly-heading" className="text-xl font-medium tracking-tight">
          {t('bookDirectlyTitle')}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{t('bookDirectlyBody')}</p>
        <div className="mt-6">
          <CalendlyEmbed url={schedulingUrl} />
        </div>
      </section>

      {/*
        TODO(appointment-request-form): the free-form request form (name, email, research group,
        time, topic → status `pending`) renders here, below the direct-booking widget. Waiting on
        design input; build with RHF + Zod against the appointments module schema.

        TODO(direct-booking-metadata): the free Calendly embed does not emit webhooks, so a
        confirmed booking is not auto-recorded. Capturing the Calendly `event_scheduled` postMessage
        and POSTing { name, email, research_group?, calendly_event_ref, requested_time } to
        `/api/appointments/direct` (status `booked`, source `direct`) is a separate, non-trivial
        slice — deferred here rather than guessed.
      */}
    </main>
  );
}
