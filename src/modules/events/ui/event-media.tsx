import Image from 'next/image';
import { YouTubeVideo } from '@/modules/integrations/youtube/youtube-video';
import { INSTITUTION_TIME_ZONE } from '@/modules/shared/lib/timezone';
import type { Event } from '../event.types';

// Shared, server-safe pieces used by both EventList (Upcoming, a Server Component) and
// PastEventList (a client island — see past-event-list.tsx for why). Nothing here needs
// interactivity, so it stays out of the client bundle for the Upcoming path.

// Without an explicit `timeZone`, `Intl.DateTimeFormat` resolves to the rendering server's ambient
// zone (UTC in the Docker container), not the visitor's and not the zone the admin actually
// entered. Pin it so every visitor sees the same, correct wall-clock time.
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

// Caps the gallery at a 2x2 grid of four tiles regardless of how many photos exist — the admin can
// upload as many as they like, but the card stays one fixed size. When there are more than four,
// the fourth tile keeps its own photo underneath a dimmed "+N" overlay for the rest, the common
// grid-with-overflow pattern (Instagram/Facebook). The overlay is `aria-hidden`: the count already
// reaches a screen reader through that tile's own alt text below.
function PhotoGallery({ urls, eventTitle }: { urls: string[]; eventTitle: string }) {
  const visible = urls.slice(0, 4);
  const remaining = urls.length - visible.length;

  return (
    <ul className="mt-5 grid grid-cols-2 gap-3">
      {visible.map((url, index) => {
        const isOverflowTile = remaining > 0 && index === visible.length - 1;
        return (
          <li
            key={`${url}-${index}`}
            className="relative aspect-square overflow-hidden rounded-lg bg-muted"
          >
            <Image
              src={url}
              alt={
                isOverflowTile
                  ? `${eventTitle} — photo ${index + 1} of ${urls.length}, plus ${remaining} more`
                  : `${eventTitle} — photo ${index + 1} of ${urls.length}`
              }
              fill
              sizes="(min-width: 640px) 25vw, 45vw"
              className="object-cover"
            />
            {isOverflowTile && (
              <div
                aria-hidden="true"
                className="absolute inset-0 flex items-center justify-center bg-foreground/55"
              >
                <span className="font-mono text-xl font-medium text-background">+{remaining}</span>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function VideoList({ ids, eventTitle }: { ids: string[]; eventTitle: string }) {
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
        <PhotoGallery urls={event.photoUrls} eventTitle={event.title} />
      )}
      {event.videoUrls.length > 0 && <VideoList ids={event.videoUrls} eventTitle={event.title} />}
    </>
  );
}
