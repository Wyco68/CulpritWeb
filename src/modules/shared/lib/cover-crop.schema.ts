import { z } from 'zod';
import { httpUrl } from './schema-fields';

// The validation half of card covers (ADR-019), kept apart from the pure helpers in `cover-crop.ts`
// so the public cards that frame a cover never ship zod to the browser.

const fraction = z.number().min(0).max(1);

/**
 * A rectangle over the cover's source image, in fractions of its width and height, so it survives
 * the image being served at any resolution.
 *
 * `url` names the image the rectangle was drawn on. A crop only means something for that one
 * image, and the cover's source can change underneath it without the crop being touched — delete
 * the first gallery photo and the second becomes the cover. `resolveCover` drops a crop whose
 * `url` no longer matches, so a stale rectangle can never frame the wrong photo.
 */
export const coverCropSchema = z
  .object({
    url: httpUrl,
    x: fraction,
    y: fraction,
    width: fraction.refine((value) => value > 0, { message: 'Must be greater than 0.' }),
    height: fraction.refine((value) => value > 0, { message: 'Must be greater than 0.' }),
  })
  // A little slack for floating-point rounding in the editor; anything more is a malformed rect.
  .refine((crop) => crop.x + crop.width <= 1.001 && crop.y + crop.height <= 1.001, {
    message: 'The crop must lie inside the photo.',
  });
export type CoverCrop = z.infer<typeof coverCropSchema>;

/** Read a stored crop defensively: a malformed JSON value renders as "no crop", never an error. */
export function parseCoverCrop(value: unknown): CoverCrop | null {
  const parsed = coverCropSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
