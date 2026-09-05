import { z } from 'zod';
import { optionalUrl, safeText } from '@/modules/shared/lib/schema-fields';

/** Admin: create a publication. */
export const createPublicationSchema = z.object({
  title: safeText(400),
  authors: safeText(1000),
  venue: safeText(400),
  year: z.coerce.number().int().min(1900).max(2100),
  /** Optional: many conference papers and book chapters have no stable public URL. */
  link: optionalUrl,
});
export type CreatePublicationInput = z.infer<typeof createPublicationSchema>;

/** Admin: partial update of a publication. */
export const updatePublicationSchema = createPublicationSchema.partial();
export type UpdatePublicationInput = z.infer<typeof updatePublicationSchema>;
