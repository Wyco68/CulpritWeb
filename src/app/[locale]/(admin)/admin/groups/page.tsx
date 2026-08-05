import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getResearchGroupService, ResearchGroupsTable } from '@/modules/research-groups';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.groups');
  return { title: t('metaTitle') };
}

export default async function AdminGroupsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const result = await getResearchGroupService().list();
  const items = result.ok ? result.data : [];

  return <ResearchGroupsTable items={items} />;
}
