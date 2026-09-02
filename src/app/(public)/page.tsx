import type { Metadata } from 'next';
import { getProfileCached, ProfileLinks } from '@/modules/profile';
import {
  ABOUT_SECTIONS,
  CvEntryList,
  getCvEntryService,
  groupBySection,
} from '@/modules/teaching';
import { EmptyState } from '@/modules/shared/ui/empty-state';
import { PageHeading } from '@/modules/shared/ui/page-heading';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'About',
    description: 'Position, education, fellowships, scholarships, and invited talks.',
  };
}

export default async function AboutPage() {
  // Two reads: the singleton profile (request-scoped, shared with the layout's site header) and
  // the five CV lists this tab renders. Teaching roles and awards are deliberately absent — they
  // live on /teaching now (ADR-012).
  const [result, entriesResult] = await Promise.all([
    getProfileCached(),
    getCvEntryService().listBySections(ABOUT_SECTIONS),
  ]);

  const entryGroups = groupBySection(
    entriesResult.ok ? entriesResult.data : [],
    ABOUT_SECTIONS,
  );

  return (
    <div>
      <PageHeading title="About" />

      {!result.ok || !result.data ? (
        <EmptyState
          title="Profile not available"
          className="mt-10"
        />
      ) : (
        <div className="mt-12 space-y-10">
          {/* The lead paragraph, set in the reading serif one step up from body size. It is the
              first prose on the site and the thing most visitors actually came for, so it is
              given the weight of a standfirst rather than the grey of secondary copy. */}
          {result.data.bio && (
            <p className="rise max-w-[62ch] text-pretty font-serif text-lg leading-[1.75] text-foreground sm:text-xl">
              {result.data.bio}
            </p>
          )}

          <ProfileLinks profile={result.data} />

          {/* Two-column flow at sm+: `columns-2` lets each section's own height decide the
              balance instead of a rigid grid. `break-inside-avoid` on every CvEntryList section
              (see cv-entry-list.tsx) keeps a section's heading and its entries together, so a
              column break never lands mid-list — the boundary between sections stays as
              unambiguous as it is in the single-column Teaching tab. */}
          <div className="sm:columns-2 sm:gap-x-10">
            <CvEntryList groups={entryGroups} />
          </div>
        </div>
      )}
    </div>
  );
}
