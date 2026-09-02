import type { Metadata } from 'next';
import {
  CourseList,
  CvEntryList,
  getCourseService,
  getCvEntryService,
  groupByLevel,
  groupBySection,
  TEACHING_SECTIONS,
} from '@/modules/teaching';
import { EmptyState } from '@/modules/shared/ui/empty-state';
import { PageHeading } from '@/modules/shared/ui/page-heading';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Teaching',
    description: 'Courses taught, teaching roles, and teaching awards.',
  };
}

export default async function TeachingPage() {
  // Two reads, not one: courses and CV entries are separate tables because a course carries a
  // code, level and term that a CV line does not.
  const [coursesResult, entriesResult] = await Promise.all([
    getCourseService().list(),
    getCvEntryService().listBySections(TEACHING_SECTIONS),
  ]);

  const courses = coursesResult.ok ? coursesResult.data : [];
  const entries = entriesResult.ok ? entriesResult.data : [];

  const courseGroups = groupByLevel(courses);
  const entryGroups = groupBySection(entries, TEACHING_SECTIONS);
  const isEmpty = courseGroups.length === 0 && entryGroups.length === 0;

  return (
    <div>
      <PageHeading title="Teaching" />

      {isEmpty ? (
        <EmptyState title="Nothing listed yet" className="mt-10" />
      ) : (
        <div className="mt-12 space-y-12">
          {courseGroups.length > 0 && <CourseList groups={courseGroups} />}
          {/* Roles and awards sit below the courses: what is currently taught is what a visitor
              came for; the CV history behind it is supporting detail. */}
          <CvEntryList groups={entryGroups} />
        </div>
      )}
    </div>
  );
}
