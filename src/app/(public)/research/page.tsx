import type { Metadata } from 'next';
import { getProfileCached } from '@/modules/profile';
import { getResearchService, ResearchList } from '@/modules/research';
import { CvEntryList, getCvEntryService, groupBySection, RESEARCH_SECTIONS } from '@/modules/teaching';
import { EmptyState } from '@/modules/shared/ui/empty-state';
import { PageHeading } from '@/modules/shared/ui/page-heading';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Research',
    description: 'Research statement, interests, current works and areas of focus.',
  };
}

export default async function ResearchPage() {
  // Three reads: the research works list, the singleton profile (for the research statement — the
  // same field About used to render before it moved here), and the research_interest CV entries
  // (also moved off About; see teaching.types.ts CvSection for the full split).
  const [result, profileResult, entriesResult] = await Promise.all([
    getResearchService().list(),
    getProfileCached(),
    getCvEntryService().listBySections(RESEARCH_SECTIONS),
  ]);

  const entryGroups = groupBySection(entriesResult.ok ? entriesResult.data : [], RESEARCH_SECTIONS);
  const researchStatement = profileResult.ok ? profileResult.data?.researchStatement : null;
  const hasIntro = Boolean(researchStatement) || entryGroups.length > 0;
  const isEmpty = !hasIntro && (!result.ok || result.data.length === 0);

  return (
    <div>
      <PageHeading title="Research" />

      {isEmpty ? (
        <EmptyState title="No research listed yet" className="mt-10" />
      ) : (
        <div className="mt-12 space-y-10">
          {researchStatement && (
            <p className="rise max-w-[62ch] text-pretty font-serif text-lg leading-[1.75] text-foreground sm:text-xl">
              {researchStatement}
            </p>
          )}

          <CvEntryList groups={entryGroups} />

          {result.ok && result.data.length > 0 && <ResearchList items={result.data} />}
        </div>
      )}
    </div>
  );
}
