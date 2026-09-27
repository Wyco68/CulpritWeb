import type { CoverCrop } from './cover-crop.schema';

// Card covers (ADR-019). Pure helpers only: the public cards import this file, so it must not pull
// in zod — the schema lives in `cover-crop.schema.ts`, which only the server imports.
// Events and research works store every photo uncropped; the only cropped
// image on the site is the 3:2 cover at the head of a card, and that crop is data rather than
// pixels. Keeping it as a rectangle over the original is what lets the admin re-frame a cover at
// any time without re-uploading, and lets the detail dialog show the very same photo whole.

/** Width ÷ height of every card cover. Matches `CardPhoto`'s `aspect-[3/2]`. */
export const COVER_ASPECT = 3 / 2;

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

export type { CoverCrop };
