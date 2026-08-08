import type { Metadata } from 'next';
import { getResearchGroupService, ResearchGroupsTable } from '@/modules/research-groups';

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Admin — Research Groups' };
}

export default async function AdminGroupsPage() {
  const result = await getResearchGroupService().list();
  const items = result.ok ? result.data : [];

  return <ResearchGroupsTable items={items} />;
}
