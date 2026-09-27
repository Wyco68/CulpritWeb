'use client';

import Image from 'next/image';
import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// The uncropped photo viewer inside the event and research detail dialogs (ADR-019). Every photo
// gets the same viewing area and keeps its own aspect ratio — `object-contain`, never cropped —
// and the strip scrolls sideways one photo at a time, by swipe or by the arrow buttons. A counter
// and position dots make it obvious there is more than one photo.

export function PhotoGallery({
  urls,
  title,
  className,
}: {
  urls: string[];
  /** What the photos are of — names the gallery region and each photo's alt text. */
  title: string;
  className?: string;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const galleryRef = useRef<HTMLDivElement>(null);

  const scrollToPhoto = (index: number) => {
    const gallery = galleryRef.current;

    if (!gallery) return;

    const nextIndex = Math.min(Math.max(index, 0), urls.length - 1);

    gallery.scrollTo({
      left: nextIndex * gallery.clientWidth,
      behavior: 'smooth',
    });

    setCurrentIndex(nextIndex);
  };

  const handleScroll = () => {
    const gallery = galleryRef.current;

    if (!gallery) return;

    const index = Math.round(gallery.scrollLeft / gallery.clientWidth);

    setCurrentIndex(Math.min(Math.max(index, 0), urls.length - 1));
  };

  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < urls.length - 1;

  return (
    <div className={className}>
      {/* The dialog's own surface behind the photos, with no frame: a photo narrower or shorter
          than the viewing area sits on the popup itself instead of inside a visible letterbox. */}
      <div className="relative overflow-hidden bg-surface">
        {/* Current photo count */}
        <div className="pointer-events-none absolute right-3 top-3 z-20 rounded-full bg-foreground/70 px-2.5 py-1 text-xs font-medium tabular-nums text-background backdrop-blur-sm">
          {currentIndex + 1} / {urls.length}
        </div>

        {/* Previous photo button */}
        {hasPrevious && (
          <button
            type="button"
            onClick={() => scrollToPhoto(currentIndex - 1)}
            aria-label="Previous photo"
            className="absolute left-3 top-1/2 z-20 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-foreground/65 text-background backdrop-blur-sm transition hover:bg-foreground/80 focus-ring"
          >
            <ChevronLeft className="size-5" aria-hidden="true" />
          </button>
        )}

        {/* Next photo button */}
        {hasNext && (
          <button
            type="button"
            onClick={() => scrollToPhoto(currentIndex + 1)}
            aria-label="Next photo"
            className="absolute right-3 top-1/2 z-20 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-foreground/65 text-background backdrop-blur-sm transition hover:bg-foreground/80 focus-ring"
          >
            <ChevronRight className="size-5" aria-hidden="true" />
          </button>
        )}

        {/* Horizontally scrollable photo viewer */}
        <div
          ref={galleryRef}
          onScroll={handleScroll}
          role="region"
          className="flex h-[min(55vh,600px)] snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth scrollbar-none"
          aria-label={`${title} photo gallery`}
        >
          {urls.map((url, index) => (
            <div
              key={`${url}-${index}`}
              className="relative h-full min-w-full shrink-0 snap-center"
            >
              <Image
                src={url}
                alt={`${title} — photo ${index + 1} of ${urls.length}`}
                fill
                sizes="(min-width: 1280px) 60vw, 90vw"
                className="object-contain"
                priority={index === 0}
              />
            </div>
          ))}
        </div>

        {/* Photo position indicators */}
        {urls.length > 1 && (
          <div
            className="pointer-events-none absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-foreground/55 px-2.5 py-1.5 backdrop-blur-sm"
            aria-hidden="true"
          >
            {urls.map((url, index) => (
              <span
                key={`${url}-indicator-${index}`}
                className={`size-1.5 rounded-full transition-all ${
                  index === currentIndex ? 'scale-125 bg-background' : 'bg-background/50'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {urls.length > 1 && (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Swipe or use the arrows to view more photos
        </p>
      )}
    </div>
  );
}
