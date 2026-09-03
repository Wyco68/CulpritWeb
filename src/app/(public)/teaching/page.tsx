import type { Metadata } from 'next';
import { getProfileCached } from '@/modules/profile';
import {
  CourseList,
  CV_SECTION_LABELS,
  CvEntryList,
  getCourseService,
  getCvEntryService,
  groupByLevel,
  groupBySection,
  TEACHING_SECTIONS,
} from '@/modules/teaching';
import { cvSectionAnchorId } from '@/modules/teaching/ui/cv-entry-list';
import { EmptyState } from '@/modules/shared/ui/empty-state';
import { PageHeading } from '@/modules/shared/ui/page-heading';
import { SectionNav, type SectionNavItem } from '@/modules/shared/ui/section-nav';
import { toMetaDescription } from '../_lib/page-meta';

const FALLBACK_DESCRIPTION = 'Courses taught, teaching roles, and teaching awards.';

export async function generateMetadata(): Promise<Metadata> {
  const result = await getProfileCached();
  return {
    title: 'Teaching',
    description: toMetaDescription(
      result.ok ? result.data?.teachingIntro : null,
      FALLBACK_DESCRIPTION,
    ),
  };
}

export default async function TeachingPage() {
  // Three reads, not one: courses and CV entries are separate tables because a course carries a
  // code, level and term that a CV line does not, and the intro rides on the singleton profile
  // (already fetched by the layout this request, so it is free here).
  const [coursesResult, entriesResult, profileResult] = await Promise.all([
    getCourseService().list(),
    getCvEntryService().listBySections(TEACHING_SECTIONS),
    getProfileCached(),
  ]);

  const courses = coursesResult.ok ? coursesResult.data : [];
  const entries = entriesResult.ok ? entriesResult.data : [];
  const intro = profileResult.ok ? profileResult.data?.teachingIntro : null;

  const courseGroups = groupByLevel(courses);
  const entryGroups = groupBySection(entries, TEACHING_SECTIONS);
  const isEmpty = courseGroups.length === 0 && entryGroups.length === 0;

  // Courses are one entry, not one per level: the levels are already a labelled rail inside the
  // list, and a jump list that repeats them would compete with the structure it is describing.
  const sections: SectionNavItem[] = [
    ...(courseGroups.length > 0 ? [{ id: 'courses', label: 'Courses' }] : []),
    ...entryGroups.map((group) => ({
      id: cvSectionAnchorId(group.section),
      label: CV_SECTION_LABELS[group.section],
    })),
  ];

  return (
    <div>
      <PageHeading title="Teaching" />

      <div className="mt-12 space-y-12">
        {intro && (
          <p className="rise max-w-[62ch] text-pretty break-words font-serif text-lg leading-[1.75] text-foreground sm:text-xl">
            {intro}
          </p>
        )}

        {isEmpty ? (
          <EmptyState title="Nothing listed yet" />
        ) : (
          <>
            <SectionNav items={sections} />

            {courseGroups.length > 0 && (
              <section id="courses" aria-label="Courses">
                <CourseList groups={courseGroups} />
              </section>
            )}
            {/* Roles and awards sit below the courses: what is currently taught is what a visitor
                came for; the CV history behind it is supporting detail. */}
            <CvEntryList groups={entryGroups} />
          </>
        )}
      </div>
    </div>
  );
}
