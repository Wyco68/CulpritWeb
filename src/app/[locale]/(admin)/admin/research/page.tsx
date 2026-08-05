import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getResearchService, ResearchTable } from '@/modules/research';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.research');
  return { title: t('metaTitle') };
}

export default async function AdminResearchPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const result = await getResearchService().list();
  const items = result.ok ? result.data : [];

  return <ResearchTable items={items} />;
}
