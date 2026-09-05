import { z } from 'zod';
import { safeText } from '@/modules/shared/lib/schema-fields';

/** Admin: create a research group. */
export const createResearchGroupSchema = z.object({
  name: safeText(200),
  description: safeText(5000),
});
export type CreateResearchGroupInput = z.infer<typeof createResearchGroupSchema>;

/** Admin: partial update of a research group. */
export const updateResearchGroupSchema = createResearchGroupSchema.partial();
export type UpdateResearchGroupInput = z.infer<typeof updateResearchGroupSchema>;
