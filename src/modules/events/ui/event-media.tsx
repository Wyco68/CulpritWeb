'use client';

import Image from 'next/image';
import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { YouTubeVideo } from '@/modules/integrations/youtube/youtube-video';
import { INSTITUTION_TIME_ZONE } from '@/modules/shared/lib/timezone';
import type { Event } from '../event.types';

// Shared media used by the event list and event detail dialog.
//
// Photos in the event detail use an Instagram-style horizontal viewer:
// - one standard-size viewing area for every photo
// - the original aspect ratio is preserved
// - photos are never cropped
// - users can scroll horizontally through all photos
// - the current photo number is shown in the top-right corner
// - arrows and position indicators make horizontal scrolling discoverable

export const dateFormatter = new Intl.DateTimeFormat('en', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: INSTITUTION_TIME_ZONE,
});

export const timeFormatter = new Intl.DateTimeFormat('en', {
  timeStyle: 'short',
  timeZone: INSTITUTION_TIME_ZONE,
});

function PhotoGallery({
  urls,
  eventTitle,
}: {
  urls: string[];
  eventTitle: string;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hasScrolled, setHasScrolled] = useState(false);
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
    setHasScrolled(true);
  };

  const handleScroll = () => {
    const gallery = galleryRef.current;

    if (!gallery) return;

    const index = Math.round(gallery.scrollLeft / gallery.clientWidth);

    setCurrentIndex(Math.min(Math.max(index, 0), urls.length - 1));

    if (gallery.scrollLeft > 10) {
      setHasScrolled(true);
    }
  };

  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < urls.length - 1;

  return (
    <div className="mt-6">
      <div className="relative overflow-hidden rounded-xl border border-border bg-muted">
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
            className="absolute left-3 top-1/2 z-20 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-foreground/65 text-background backdrop-blur-sm transition hover:bg-foreground/80 focus:outline-none focus:ring-2 focus:ring-ring"
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
            className="absolute right-3 top-1/2 z-20 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-foreground/65 text-background backdrop-blur-sm transition hover:bg-foreground/80 focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <ChevronRight className="size-5" aria-hidden="true" />
          </button>
        )}

        {/* Horizontally scrollable photo viewer */}
        <div
          ref={galleryRef}
          onScroll={handleScroll}
          className="flex h-[min(55vh,600px)] snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth scrollbar-none"
          aria-label={`${eventTitle} photo gallery`}
        >
          {urls.map((url, index) => (
            <div
              key={`${url}-${index}`}
              className="relative h-full min-w-full shrink-0 snap-center"
            >
              <Image
                src={url}
                alt={`${eventTitle} — photo ${index + 1} of ${urls.length}`}
                fill
                sizes="(min-width: 1280px) 60vw, 90vw"
                className="object-contain"
                priority={index === 0}
              />
            </div>
          ))}
        </div>

        {/* Swipe hint */}
        {urls.length > 1 && !hasScrolled && (
          <div className="pointer-events-none absolute bottom-12 left-1/2 z-20 -translate-x-1/2 rounded-full bg-foreground/70 px-4 py-2 text-xs font-medium text-background backdrop-blur-sm">
            Swipe to see more
          </div>
        )}

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
                  index === currentIndex
                    ? 'scale-125 bg-background'
                    : 'bg-background/50'
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

function VideoList({
  ids,
  eventTitle,
}: {
  ids: string[];
  eventTitle: string;
}) {
  return (
    <ul className="mt-5 grid gap-4 sm:grid-cols-2">
      {ids.map((id, index) => (
        <li key={id}>
          <YouTubeVideo
            videoId={id}
            title={
              ids.length === 1
                ? `Video from ${eventTitle}`
                : `Video ${index + 1} of ${ids.length} from ${eventTitle}`
            }
          />
        </li>
      ))}
    </ul>
  );
}

export function EventMedia({ event }: { event: Event }) {
  return (
    <>
      {event.photoUrls.length > 0 && (
        <PhotoGallery
          urls={event.photoUrls}
          eventTitle={event.title}
        />
      )}

      {event.videoUrls.length > 0 && (
        <VideoList
          ids={event.videoUrls}
          eventTitle={event.title}
        />
      )}
    </>
  );
}