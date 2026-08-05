import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getPublicationService, PublicationsTable } from '@/modules/publications';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.publications');
  return { title: t('metaTitle') };
}

export default async function AdminPublicationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const result = await getPublicationService().list();
  const items = result.ok ? result.data : [];

  return <PublicationsTable items={items} />;
}
