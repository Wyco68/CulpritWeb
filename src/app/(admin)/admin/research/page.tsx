import type { Metadata } from 'next';
import { getResearchService, ResearchTable } from '@/modules/research';

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Admin — Research' };
}

export default async function AdminResearchPage() {
  const result = await getResearchService().list();
  const items = result.ok ? result.data : [];

  return <ResearchTable items={items} />;
}
