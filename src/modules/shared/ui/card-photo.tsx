import Image from 'next/image';
import { cn } from '@/modules/shared/lib/utils';
import { coverCropStyle, type CoverCrop } from '@/modules/shared/lib/cover-crop';

// The 3:2 cover at the head of a content card (research works, events). The card's title sits
// right beneath it and names the subject, so the image is decorative to assistive tech (`alt=""`).
// Without a photo the frame shows engraved rings on the masthead green — the site's own ornament,
// drawn by one CSS gradient rather than a per-card SVG — so a grid mixing cards with and without
// photos still lines up.
//
// The photo is stored uncropped (ADR-019). With a `crop`, only that rectangle of it shows: the
// image is scaled and shifted inside the frame by `coverCropStyle`. Without one it is centred and
// trimmed to fill the frame, as every cover was before crops existed.

/** Rendered widths of a card, as `sizes` media conditions. */
const CARD_WIDTHS: [condition: string | null, px: number | string][] = [
  ['(min-width: 1280px)', 340],
  ['(min-width: 640px)', '50vw'],
  [null, '100vw'],
];

/**
 * `sizes` for the image. A crop shows only part of it, so the image itself is drawn wider than the
 * card by `1 / crop.width` — asking for a card-width file would leave a zoomed-in cover blurry.
 */
function sizesFor(crop: CoverCrop | null | undefined): string {
  const factor = crop ? 1 / crop.width : 1;
  return CARD_WIDTHS.map(([condition, width]) => {
    const scaled =
      typeof width === 'number'
        ? `${Math.round(width * factor)}px`
        : `${Math.round(parseFloat(width) * factor)}vw`;
    return condition ? `${condition} ${scaled}` : scaled;
  }).join(', ');
}

export function CardPhoto({
  src,
  crop,
  className,
}: {
  src: string | null | undefined;
  /** The admin's framing of `src`. Already matched to `src` by `resolveCover`. */
  crop?: CoverCrop | null;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'relative aspect-[3/2] overflow-hidden border-b border-border bg-masthead',
        className,
      )}
    >
      {src ? (
        crop ? (
          <div style={coverCropStyle(crop)}>
            <Image src={src} alt="" fill sizes={sizesFor(crop)} className="object-cover" />
          </div>
        ) : (
          <Image src={src} alt="" fill sizes={sizesFor(null)} className="object-cover" />
        )
      ) : (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[repeating-radial-gradient(circle_at_72%_38%,transparent_0_7px,color-mix(in_srgb,var(--engraving)_28%,transparent)_7px_8px)]"
        />
      )}
    </div>
  );
}
