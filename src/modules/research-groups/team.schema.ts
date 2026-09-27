import { z } from 'zod';
import { safeText, sortOrder } from '@/modules/shared/lib/schema-fields';

/** Admin: create a team. The name is whatever the lab calls the group. */
export const createTeamSchema = z.object({
  name: safeText(100),
  sortOrder,
});
export type CreateTeamInput = z.infer<typeof createTeamSchema>;

/** Admin: rename or move a team. */
export const updateTeamSchema = createTeamSchema.partial();
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
