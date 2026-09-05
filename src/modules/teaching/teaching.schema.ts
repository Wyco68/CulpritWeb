import { z } from 'zod';
import { optionalText, optionalUrl, safeText, sortOrder } from '@/modules/shared/lib/schema-fields';
import { CV_SECTIONS } from './teaching.types';

/** Which list an entry belongs to. Mirrors the Prisma enum; validated at the boundary. */
export const cvSectionSchema = z.enum(CV_SECTIONS);

/** Admin: create a CV entry. */
export const createCvEntrySchema = z.object({
  section: cvSectionSchema,
  title: safeText(300),
  subtitle: optionalText(300),
  // Free text rather than a number — "2019-2023" and "present" are both normal.
  year: optionalText(50),
  description: optionalText(2000),
  sortOrder,
});
export type CreateCvEntryInput = z.infer<typeof createCvEntrySchema>;

/** Admin: partial update of a CV entry. */
export const updateCvEntrySchema = createCvEntrySchema.partial();
export type UpdateCvEntryInput = z.infer<typeof updateCvEntrySchema>;

/** Admin: create a course. */
export const createCourseSchema = z.object({
  code: optionalText(50),
  title: safeText(300),
  level: safeText(100),
  term: optionalText(100),
  description: optionalText(5000),
  link: optionalUrl,
  sortOrder,
});
export type CreateCourseInput = z.infer<typeof createCourseSchema>;

/** Admin: partial update of a course. */
export const updateCourseSchema = createCourseSchema.partial();
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;
