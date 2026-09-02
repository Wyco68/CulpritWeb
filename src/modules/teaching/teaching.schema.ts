import { z } from 'zod';
import { stripHtml } from '@/modules/shared/lib/sanitize';
import { CV_SECTIONS } from './teaching.types';

// Single source of truth for teaching I/O. Free-text fields are sanitized (HTML stripped) via
// `.transform` AFTER shape validation — same convention as every other module here.

const safeText = (max: number) => z.string().trim().min(1).max(max).transform(stripHtml);
const optionalSafeText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => stripHtml(v) || null)
    .nullable()
    .optional();

/** An optional external link. Empty string from an untouched form input means "unset". */
const optionalUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => v === '' || z.string().url().safeParse(v).success, {
    message: 'Must be a valid URL.',
  })
  .transform((v) => v || null)
  .nullable()
  .optional();

/** Which list an entry belongs to. Mirrors the Prisma enum; validated at the boundary. */
export const cvSectionSchema = z.enum(CV_SECTIONS);

/** Admin: create a CV entry. */
export const createCvEntrySchema = z.object({
  section: cvSectionSchema,
  title: safeText(300),
  subtitle: optionalSafeText(300),
  // Free text rather than a number — "2019-2023" and "present" are both normal.
  year: optionalSafeText(50),
  description: optionalSafeText(2000),
  sortOrder: z.coerce.number().int().min(0).max(100_000).optional(),
});
export type CreateCvEntryInput = z.infer<typeof createCvEntrySchema>;

/** Admin: partial update of a CV entry. */
export const updateCvEntrySchema = createCvEntrySchema.partial();
export type UpdateCvEntryInput = z.infer<typeof updateCvEntrySchema>;

/** Admin: create a course. */
export const createCourseSchema = z.object({
  code: optionalSafeText(50),
  title: safeText(300),
  level: safeText(100),
  term: optionalSafeText(100),
  description: optionalSafeText(5000),
  link: optionalUrl,
  sortOrder: z.coerce.number().int().min(0).max(100_000).optional(),
});
export type CreateCourseInput = z.infer<typeof createCourseSchema>;

/** Admin: partial update of a course. */
export const updateCourseSchema = createCourseSchema.partial();
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;

/** Admin: identify a record by id (PUT/DELETE path param, re-validated at the boundary). */
export const teachingIdSchema = z.string().trim().min(1).max(200);
