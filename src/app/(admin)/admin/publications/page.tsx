import type { Metadata } from 'next';
import { getPublicationService, PublicationsTable } from '@/modules/publications';

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Admin — Publications' };
}

export default async function AdminPublicationsPage() {
  const result = await getPublicationService().list();
  const items = result.ok ? result.data : [];

  return <PublicationsTable items={items} />;
}
