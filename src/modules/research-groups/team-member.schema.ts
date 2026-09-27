import { z } from 'zod';
import { stripHtml } from '@/modules/shared/lib/sanitize';
import {
  entityId,
  httpUrl,
  optionalText,
  safeText,
  sortOrder,
} from '@/modules/shared/lib/schema-fields';
import { PROFILE_SECTIONS } from '@/modules/shared/lib/profile-sections';

/**
 * The profile sections to hide. De-duplicated and put in page order, so the stored list is
 * canonical whatever order the switches were flipped in.
 */
export const hiddenSectionsSchema = z
  .array(z.enum(PROFILE_SECTIONS))
  .max(PROFILE_SECTIONS.length)
  .transform((sections) => PROFILE_SECTIONS.filter((section) => sections.includes(section)));

/**
 * One external profile link. `label` is free text the admin types — deliberately NOT validated
 * against a known list, so a new service is data rather than a migration. `url` goes through the
 * same http(s)-only check as every other stored URL: these render straight into an `href`.
 */
const memberLink = z.object({
  label: safeText(60),
  url: httpUrl,
});
export type MemberLinkInput = z.infer<typeof memberLink>;

/** An ordered link list; the array order is the display order. Empty renders no links. */
const linkList = z.array(memberLink).max(20);

/** Admin: create a team member. */
export const createTeamMemberSchema = z.object({
  name: safeText(200),
  /** How they are credited on a paper, e.g. "J. Jaimunk". Byline names are matched against it. */
  citationName: optionalText(200),
  role: safeText(200),
  affiliation: optionalText(300),
  // Optional-only, unlike the other free-text fields: an emptied bio arrives as `undefined`, whose
  // key JSON.stringify drops, so the update route leaves the column as it was.
  bio: z
    .string()
    .trim()
    .max(5000)
    .transform((value) => stripHtml(value) || undefined)
    .optional(),
  // Nullable, not just optional: an undefined key vanishes from the JSON body and the update
  // route reads that as "leave the column alone", so removing a photo needs an explicit null.
  photoUrl: httpUrl.nullable().optional(),
  /** The team they are listed under; `null` for none. Must name an existing team. */
  teamId: entityId.nullable().optional(),
  // No `isDirector`: the lab has exactly one director, and the admin cannot make anyone else one
  // (ADR-020). Unknown keys are stripped, so a request that sends it changes nothing.
  hiddenSections: hiddenSectionsSchema.optional(),
  /** The whole link list, replacing whatever is stored. Absent on an update means "leave alone". */
  links: linkList.default([]),
  sortOrder,
});
export type CreateTeamMemberInput = z.infer<typeof createTeamMemberSchema>;

/**
 * Admin: partial update of a team member.
 *
 * `links` is re-declared without its `.default([])`: `.partial()` alone keeps the default, so an
 * update that never mentions links would arrive as an empty array and the repository would replace
 * the stored list with nothing. Absent has to stay absent for "leave them alone" to hold.
 */
export const updateTeamMemberSchema = createTeamMemberSchema
  .partial()
  .extend({ links: linkList.optional() });
export type UpdateTeamMemberInput = z.infer<typeof updateTeamMemberSchema>;
