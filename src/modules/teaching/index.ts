// teaching module — the Teaching tab (courses + teaching roles/awards) and the CV-entry lists that
// the About tab renders. Replaced seven Json columns on `profile` on 2026-09-02; see
// docs/decisions/ADR-012-cv-entries-and-courses.md for why one table with a `section`
// discriminator rather than seven tables.

export {
  cvSectionSchema,
  createCvEntrySchema,
  updateCvEntrySchema,
  createCourseSchema,
  updateCourseSchema,
  teachingIdSchema,
  type CreateCvEntryInput,
  type UpdateCvEntryInput,
  type CreateCourseInput,
  type UpdateCourseInput,
} from './teaching.schema';

export {
  CV_SECTIONS,
  ABOUT_SECTIONS,
  TEACHING_SECTIONS,
  CV_SECTION_LABELS,
  type CvSection,
  type CvEntry,
  type Course,
  type AuditContext,
} from './teaching.types';

export {
  createCvEntryService,
  createCourseService,
  groupBySection,
  groupByLevel,
  type CvEntryService,
  type CourseService,
} from './teaching.service';

export type { CvEntryRepository } from './cv-entry.repository';
export type { CourseRepository } from './course.repository';

export { getCvEntryService, getCourseService } from './container';

export { CvEntryList } from './ui/cv-entry-list';
export { CourseList } from './ui/course-list';
export { TeachingAdmin } from './ui/teaching-admin';
