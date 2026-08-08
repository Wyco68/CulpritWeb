import type { Metadata } from 'next';
import { BookMarked } from 'lucide-react';
import { getPublicationService, PublicationsList } from '@/modules/publications';
import { EmptyState } from '@/modules/shared/ui/empty-state';

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
      <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Publications</h2>

      {!result.ok || result.data.length === 0 ? (
        <EmptyState
          icon={BookMarked}
          title="No publications listed yet"
          description="Please check back soon."
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
