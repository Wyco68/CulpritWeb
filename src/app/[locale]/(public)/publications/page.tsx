import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { BookMarked } from 'lucide-react';
import { getPublicationService, PublicationsList } from '@/modules/publications';
import { EmptyState } from '@/modules/shared/ui/empty-state';

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'publications' });
  return { title: t('metaTitle'), description: t('metaDescription') };
}

export default async function PublicationsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('publications');

  const result = await getPublicationService().list();

  return (
    <div>
      <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{t('title')}</h2>

      {!result.ok || result.data.length === 0 ? (
        <EmptyState
          icon={BookMarked}
          title={t('emptyTitle')}
          description={t('emptyBody')}
          className="mt-6"
        />
      ) : (
        <div className="mt-6">
          <PublicationsList items={result.data} />
        </div>
      )}
    </div>
  );
}
