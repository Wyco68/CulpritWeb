import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { FlaskConical } from 'lucide-react';
import { getResearchService, ResearchList } from '@/modules/research';
import { EmptyState } from '@/modules/shared/ui/empty-state';

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'research' });
  return { title: t('metaTitle'), description: t('metaDescription') };
}

export default async function ResearchPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('research');

  const result = await getResearchService().list();

  return (
    <div>
      <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{t('title')}</h2>

      {!result.ok || result.data.length === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title={t('emptyTitle')}
          description={t('emptyBody')}
          className="mt-6"
        />
      ) : (
        <div className="mt-6">
          <ResearchList items={result.data} />
        </div>
      )}
    </div>
  );
}
