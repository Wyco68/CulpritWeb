import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CalendlyEmbed } from '@/modules/integrations';

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
          <CalendlyEmbed />
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
