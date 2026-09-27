import { z } from 'zod';
import { httpUrl } from './schema-fields';

// Card covers (ADR-019). Events and research works store every photo uncropped; the only cropped
// image on the site is the 3:2 cover at the head of a card, and that crop is data rather than
// pixels. Keeping it as a rectangle over the original is what lets the admin re-frame a cover at
// any time without re-uploading, and lets the detail dialog show the very same photo whole.

/** Width ÷ height of every card cover. Matches `CardPhoto`'s `aspect-[3/2]`. */
export const COVER_ASPECT = 3 / 2;

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

/** The fields a card cover is derived from — shared by events and research works. */
export type CoverSource = {
  coverPhotoUrl: string | null;
  photoUrls: string[];
  coverCrop: CoverCrop | null;
};

/**
 * The image a card shows and how to frame it: the dedicated cover when there is one, otherwise the
 * first gallery photo. The crop applies only if it was drawn on that same image.
 */
export function resolveCover(item: CoverSource): { src: string | null; crop: CoverCrop | null } {
  const src = item.coverPhotoUrl ?? item.photoUrls[0] ?? null;
  const crop = src && item.coverCrop?.url === src ? item.coverCrop : null;
  return { src, crop };
}

/**
 * Absolute-position styles that show just `crop` of an image inside a box of the cover's aspect.
 * The image is scaled so the crop's width fills the box, then shifted so the crop's corner sits at
 * the box's corner. Percentages of the box, so no pixel size is needed at render time.
 */
export function coverCropStyle(crop: CoverCrop): React.CSSProperties {
  return {
    position: 'absolute',
    width: `${100 / crop.width}%`,
    height: `${100 / crop.height}%`,
    left: `${(-crop.x / crop.width) * 100}%`,
    top: `${(-crop.y / crop.height) * 100}%`,
  };
}
