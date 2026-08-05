import { z } from 'zod';
import { stripHtml } from '@/modules/shared/lib/sanitize';

// Single source of truth for publication I/O. Free-text fields are sanitized (HTML stripped) via
// `.transform` AFTER shape validation.

const safeText = (max: number) => z.string().trim().min(1).max(max).transform(stripHtml);

/** Admin: create a publication. */
export const createPublicationSchema = z.object({
  title: safeText(400),
  authors: safeText(1000),
  venue: safeText(400),
  year: z.coerce.number().int().min(1900).max(2100),
  link: z.string().trim().min(1).max(2000).url(),
});
export type CreatePublicationInput = z.infer<typeof createPublicationSchema>;

/** Admin: partial update of a publication. */
export const updatePublicationSchema = createPublicationSchema.partial();
export type UpdatePublicationInput = z.infer<typeof updatePublicationSchema>;

/** Admin: identify a publication by id (PUT/DELETE path param, re-validated at the boundary). */
export const publicationIdSchema = z.string().trim().min(1).max(200);
