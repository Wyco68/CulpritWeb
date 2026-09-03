import type { Metadata } from 'next';
import { getProfileCached, ProfileLinks } from '@/modules/profile';
import {
  ABOUT_SECTIONS,
  CV_SECTION_LABELS,
  CvEntryList,
  getCvEntryService,
  groupBySection,
} from '@/modules/teaching';
import { cvSectionAnchorId } from '@/modules/teaching/ui/cv-entry-list';
import { EmptyState } from '@/modules/shared/ui/empty-state';
import { PageHeading } from '@/modules/shared/ui/page-heading';
import { SectionNav, type SectionNavItem } from '@/modules/shared/ui/section-nav';

const FALLBACK_DESCRIPTION =
  'Position, education, fellowships, scholarships, and invited talks.';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'About',
    description: FALLBACK_DESCRIPTION,
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

  const profile = result.ok ? result.data : null;

  // The jump list mirrors what is actually on the page: the biography block, then whichever CV
  // lists have entries. `groupBySection` has already dropped the empty ones, so a section can
  // never be advertised and then not be there to land on.
  const sections: SectionNavItem[] = [
    ...(profile?.bio ? [{ id: 'biography', label: 'Biography' }] : []),
    ...entryGroups.map((group) => ({
      id: cvSectionAnchorId(group.section),
      label: CV_SECTION_LABELS[group.section],
    })),
  ];

  return (
    <div>
      <PageHeading title="About" />

      {!profile ? (
        <EmptyState
          title="Profile not available"
          className="mt-10"
        />
      ) : (
        <div className="mt-12 space-y-10">
          <SectionNav items={sections} />

          {/* The lead paragraph, set in the reading serif one step up from body size. It is the
              first prose on the site and the thing most visitors actually came for, so it is
              given the weight of a standfirst rather than the grey of secondary copy.
              The external-profile links ride inside the same anchor target: they are two lines of
              "where else to find this person", not a destination worth its own jump-list entry. */}
          {(profile.bio || profile.linkedinUrl || profile.googleScholarUrl) && (
            <section id="biography" aria-label="Biography" className="space-y-10">
              {profile.bio && (
                <p className="rise max-w-[62ch] text-pretty break-words font-serif text-lg leading-[1.75] text-foreground sm:text-xl">
                  {profile.bio}
                </p>
              )}

              <ProfileLinks profile={profile} />
            </section>
          )}

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
