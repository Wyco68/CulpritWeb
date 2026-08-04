import { z } from 'zod';
import { stripHtml } from '@/modules/shared/lib/sanitize';

// Single source of truth for research I/O. Free-text fields are sanitized (HTML stripped) via
// `.transform` AFTER shape validation.

const safeText = (max: number) => z.string().trim().min(1).max(max).transform(stripHtml);

/** Admin: create a research work. */
export const createResearchSchema = z.object({
  title: safeText(300),
  summary: safeText(5000),
  area: safeText(200),
  sortOrder: z.coerce.number().int().min(0).max(100_000).optional(),
});
export type CreateResearchInput = z.infer<typeof createResearchSchema>;

/** Admin: partial update of a research work. */
export const updateResearchSchema = createResearchSchema.partial();
export type UpdateResearchInput = z.infer<typeof updateResearchSchema>;

/** Admin: identify a research work by id (PUT/DELETE path param, re-validated at the boundary). */
export const researchIdSchema = z.string().trim().min(1).max(200);
