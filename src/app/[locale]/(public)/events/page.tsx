import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CalendarClock, EyeOff } from 'lucide-react';
import {
  getUpcomingEventsService,
  toAppointmentView,
  UpcomingEventsList,
} from '@/modules/appointments';
import { EmptyState } from '@/modules/shared/ui/empty-state';

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'events' });
  return { title: t('metaTitle'), description: t('metaDescription') };
}

export default async function EventsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('events');

  const result = await getUpcomingEventsService().getUpcomingEvents();
  // Never 404/hide the tab itself — render an explicit disabled state when the admin has the
  // visibility setting off, per FR-5 and the upcoming-events service contract.
  const visible = result.ok && result.data.visible;
  const events = result.ok ? result.data.events.map(toAppointmentView) : [];

  return (
    <div>
      <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{t('title')}</h2>

      {!result.ok || !visible ? (
        <EmptyState
          icon={EyeOff}
          title={t('hiddenTitle')}
          description={t('hiddenBody')}
          className="mt-6"
        />
      ) : events.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title={t('emptyTitle')}
          description={t('emptyBody')}
          className="mt-6"
        />
      ) : (
        <div className="mt-6">
          <UpcomingEventsList events={events} />
        </div>
      )}
    </div>
  );
}
