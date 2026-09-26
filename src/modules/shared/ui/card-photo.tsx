import Image from 'next/image';
import { cn } from '@/modules/shared/lib/utils';

// The 3:2 image at the head of a content card (research works, events). The card's title sits
// right beneath it and names the subject, so the image is decorative to assistive tech (`alt=""`).
// Without a photo the frame shows engraved rings on the masthead green — the site's own ornament,
// drawn by one CSS gradient rather than a per-card SVG — so a grid mixing cards with and without
// photos still lines up.
export function CardPhoto({
  src,
  className,
}: {
  src: string | null | undefined;
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
        <Image
          src={src}
          alt=""
          fill
          sizes="(min-width: 1280px) 340px, (min-width: 640px) 50vw, 100vw"
          className="object-cover"
        />
      ) : (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[repeating-radial-gradient(circle_at_72%_38%,transparent_0_7px,color-mix(in_srgb,var(--engraving)_28%,transparent)_7px_8px)]"
        />
      )}
    </div>
  );
}
