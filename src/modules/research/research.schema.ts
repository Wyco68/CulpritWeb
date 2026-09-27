import { z } from 'zod';
import { httpUrl, optionalUrl, safeText, sortOrder } from '@/modules/shared/lib/schema-fields';
import { coverCropSchema } from '@/modules/shared/lib/cover-crop.schema';

/**
 * One credited contributor: a plain typed name. Same shape and reasoning as a publication author —
 * see `publication.schema.ts`. Duplicated rather than shared: the two lists differ in their bounds,
 * and a shared fragment would couple two modules for a few lines.
 */
const researchContributor = z.object({
  name: safeText(200),
});

/** In display order. Empty renders no byline. */
const contributorList = z.array(researchContributor).max(20);

/** Admin: create a research work. */
export const createResearchSchema = z.object({
  title: safeText(300),
  summary: safeText(5000),
  area: safeText(200),
  /** Optional external artefact — a tool listing, project page or dataset. */
  link: optionalUrl,
  /** Dedicated card cover: a URL returned by the admin photo upload. `null` clears it. */
  coverPhotoUrl: httpUrl.nullable().optional(),
  /** The detail dialog's gallery, uncropped, in display order. */
  photoUrls: z.array(httpUrl).max(20).optional(),
  /** How the cover is framed on the card. `null` centres it. */
  coverCrop: coverCropSchema.nullable().optional(),
  contributors: contributorList.default([]),
  sortOrder,
});
export type CreateResearchInput = z.infer<typeof createResearchSchema>;
export type ResearchContributorInput = z.infer<typeof researchContributor>;

/**
 * Admin: partial update of a research work.
 *
 * `contributors` is re-declared without its `.default([])` — see the note on
 * `updatePublicationSchema`, which had the identical defect. Absent means "leave the byline alone";
 * an explicit `[]` clears it.
 */
export const updateResearchSchema = createResearchSchema
  .partial()
  .extend({ contributors: contributorList.optional() });
export type UpdateResearchInput = z.infer<typeof updateResearchSchema>;
