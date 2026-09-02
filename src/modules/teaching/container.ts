import { PrismaCvEntryRepository } from './cv-entry.repository';
import { PrismaCourseRepository } from './course.repository';
import {
  createCvEntryService,
  createCourseService,
  type CvEntryService,
  type CourseService,
} from './teaching.service';

// Composition root: wires the Prisma-backed repositories into the services. Route handlers and
// Server Components call these getters and nothing else.

let cachedEntries: CvEntryService | undefined;
let cachedCourses: CourseService | undefined;

export function getCvEntryService(): CvEntryService {
  if (!cachedEntries) {
    cachedEntries = createCvEntryService({ repository: new PrismaCvEntryRepository() });
  }
  return cachedEntries;
}

export function getCourseService(): CourseService {
  if (!cachedCourses) {
    cachedCourses = createCourseService({ repository: new PrismaCourseRepository() });
  }
  return cachedCourses;
}
