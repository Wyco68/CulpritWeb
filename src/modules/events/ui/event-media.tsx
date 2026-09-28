import { YouTubeVideo } from '@/modules/integrations/youtube/youtube-video';
import { INSTITUTION_TIME_ZONE } from '@/modules/shared/lib/timezone';
import { PhotoGallery } from '@/modules/shared/ui/photo-gallery';
import type { Event } from '../event.types';

// Shared pieces used by the event list and the event detail dialog. Photos are shown uncropped by
// the shared `PhotoGallery`; videos are YouTube embeds.

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

/** "12 Mar 2026 at 2:30 PM", or the date alone for a date-only event. */
export function formatEventWhen(event: Pick<Event, 'eventDate' | 'showTime'>): string {
  const date = dateFormatter.format(event.eventDate);
  return event.showTime ? `${date} at ${timeFormatter.format(event.eventDate)}` : date;
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
        <PhotoGallery urls={event.photoUrls} title={event.title} className="mt-6" />
      )}

      {event.videoUrls.length > 0 && <VideoList ids={event.videoUrls} eventTitle={event.title} />}
    </>
  );
}
