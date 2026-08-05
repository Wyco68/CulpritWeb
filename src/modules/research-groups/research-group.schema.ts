import { z } from 'zod';
import { stripHtml } from '@/modules/shared/lib/sanitize';

// Single source of truth for research-group I/O. Free-text fields are sanitized (HTML stripped)
// via `.transform` AFTER shape validation.

const safeText = (max: number) => z.string().trim().min(1).max(max).transform(stripHtml);

/** Admin: create a research group. */
export const createResearchGroupSchema = z.object({
  name: safeText(200),
  description: safeText(5000),
});
export type CreateResearchGroupInput = z.infer<typeof createResearchGroupSchema>;

/** Admin: partial update of a research group. */
export const updateResearchGroupSchema = createResearchGroupSchema.partial();
export type UpdateResearchGroupInput = z.infer<typeof updateResearchGroupSchema>;

/** Admin: identify a research group by id (PUT/DELETE path param, re-validated at the boundary). */
export const researchGroupIdSchema = z.string().trim().min(1).max(200);
