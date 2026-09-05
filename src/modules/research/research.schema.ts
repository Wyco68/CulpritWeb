import { z } from 'zod';
import { optionalUrl, safeText, sortOrder } from '@/modules/shared/lib/schema-fields';

/** Admin: create a research work. */
export const createResearchSchema = z.object({
  title: safeText(300),
  summary: safeText(5000),
  area: safeText(200),
  /** Optional external artefact — a tool listing, project page or dataset. */
  link: optionalUrl,
  sortOrder,
});
export type CreateResearchInput = z.infer<typeof createResearchSchema>;

/** Admin: partial update of a research work. */
export const updateResearchSchema = createResearchSchema.partial();
export type UpdateResearchInput = z.infer<typeof updateResearchSchema>;
