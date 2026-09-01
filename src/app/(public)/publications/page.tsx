import type { Metadata } from 'next';
import { getPublicationService, PublicationsList } from '@/modules/publications';
import { EmptyState } from '@/modules/shared/ui/empty-state';
import { PageHeading } from '@/modules/shared/ui/page-heading';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Publications',
    description: 'Peer-reviewed publications and external links.',
  };
}

export default async function PublicationsPage() {
  const result = await getPublicationService().list();

  return (
    <div>
      <PageHeading title="Publications" />

      {!result.ok || result.data.length === 0 ? (
        <EmptyState title="No publications listed yet" className="mt-10" />
      ) : (
        <div className="mt-12">
          <PublicationsList items={result.data} />
        </div>
      )}
    </div>
  );
}
