import type { Metadata } from 'next';
import { FlaskConical } from 'lucide-react';
import { getResearchService, ResearchList } from '@/modules/research';
import { EmptyState } from '@/modules/shared/ui/empty-state';

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
      <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Research</h2>

      {!result.ok || result.data.length === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title="No research works published yet"
          description="Please check back soon."
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
