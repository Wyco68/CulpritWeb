import { z } from 'zod';
import { stripHtml } from '@/modules/shared/lib/sanitize';

// Single source of truth for profile I/O. Free-text fields are sanitized (HTML stripped) via
// `.transform` AFTER shape validation — same convention as the appointments module.

const safeText = (max: number) => z.string().trim().min(1).max(max).transform(stripHtml);
const optionalSafeText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => stripHtml(v) || undefined)
    .optional();

/** One CV-style entry (education, fellowship, teaching role/award, talk, …). */
const listItemSchema = z.object({
  title: safeText(300),
  subtitle: optionalSafeText(300),
  year: optionalSafeText(50),
  description: optionalSafeText(2000),
});
const listSchema = (maxItems: number) => z.array(listItemSchema).max(maxItems);

/** An optional external profile link. Empty string from an untouched form input means "unset". */
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

/** Admin: replace the whole structured profile (singleton, full-document PUT). */
export const updateProfileSchema = z.object({
  fullName: safeText(200),
  title: safeText(200),
  photoUrl: z
    .string()
    .trim()
    .max(2000)
    .url()
    .nullable()
    .optional(),
  bio: optionalSafeText(5000),
  positionAffiliation: optionalSafeText(3000),
  education: listSchema(50).optional(),
  fellowshipsVisiting: listSchema(50).optional(),
  teachingRoles: listSchema(50).optional(),
  teachingAwards: listSchema(50).optional(),
  scholarshipsTravelAwards: listSchema(50).optional(),
  researchInterests: listSchema(50).optional(),
  researchStatement: optionalSafeText(5000),
  invitedTalks: listSchema(50).optional(),
  linkedinUrl: optionalUrl,
  googleScholarUrl: optionalUrl,
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
