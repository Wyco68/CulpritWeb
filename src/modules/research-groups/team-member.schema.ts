import { z } from 'zod';
import { stripHtml } from '@/modules/shared/lib/sanitize';

// Single source of truth for team-member I/O. Free-text fields are sanitized (HTML stripped) via
// `.transform` AFTER shape validation.

const safeText = (max: number) => z.string().trim().min(1).max(max).transform(stripHtml);
const optionalSafeText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => stripHtml(v) || undefined)
    .optional();

/** Admin: create a team member. `researchGroupId` is optional — a member need not belong to a group. */
export const createTeamMemberSchema = z.object({
  name: safeText(200),
  // Nullable as well as optional, so clearing the field actually clears the column — an undefined
  // key vanishes from the JSON body and the update route reads that as "leave it alone".
  nickname: z
    .string()
    .trim()
    .max(100)
    .transform((v) => stripHtml(v) || null)
    .nullable()
    .optional(),
  role: safeText(200),
  bio: optionalSafeText(3000),
  // Nullable, not just optional: an undefined key vanishes from the JSON body and the update
  // route reads that as "leave the column alone", so removing a photo needs an explicit null.
  photoUrl: z.string().trim().max(2000).url().nullable().optional(),
  researchGroupId: z.string().trim().min(1).max(200).nullable().optional(),
  sortOrder: z.coerce.number().int().min(0).max(100_000).optional(),
});
export type CreateTeamMemberInput = z.infer<typeof createTeamMemberSchema>;

/** Admin: partial update of a team member. */
export const updateTeamMemberSchema = createTeamMemberSchema.partial();
export type UpdateTeamMemberInput = z.infer<typeof updateTeamMemberSchema>;

/** Admin: identify a team member by id (PUT/DELETE path param, re-validated at the boundary). */
export const teamMemberIdSchema = z.string().trim().min(1).max(200);

/** Public: `groupId` path param on the filtered list route (`/api/team-members/group/[groupId]`). */
export const teamMemberGroupIdSchema = z.string().trim().min(1).max(200);
