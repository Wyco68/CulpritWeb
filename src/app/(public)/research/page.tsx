import type { Metadata } from 'next';
import { getResearchService, ResearchList } from '@/modules/research';
import { EmptyState } from '@/modules/shared/ui/empty-state';
import { PageHeading } from '@/modules/shared/ui/page-heading';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Research',
    description: 'Current research works and areas of focus.',
  };
}

export default async function ResearchPage() {
  const result = await getResearchService().list();

  return (
    <div>
      <PageHeading title="Research" />

      {!result.ok || result.data.length === 0 ? (
        <EmptyState title="No research listed yet" className="mt-10" />
      ) : (
        <div className="mt-12">
          <ResearchList items={result.data} />
        </div>
      )}
    </div>
  );
}
