import Image from 'next/image';
import { YouTubeVideo } from '@/modules/integrations/youtube/youtube-video';
import { INSTITUTION_TIME_ZONE } from '@/modules/shared/lib/timezone';
import type { Event } from '../event.types';

// The public Events tab's list, used for both the Upcoming and the Past section — the two differ
// only in ordering and heading, which the page owns, so there is one component here rather than
// two near-identical ones.
//
// Same shape as the Research index and Publications list: a date in the left rail as a running
// head, the content in the reading column beside it. Media hang below the description rather than
// beside it, so a photo-heavy event doesn't squeeze its own prose into a gutter.

// This is a Server Component — without an explicit `timeZone`, `Intl.DateTimeFormat` resolves to
// the rendering server's ambient zone (UTC in the Docker container), not the visitor's and not the
// zone the admin actually entered. Pin it so every visitor sees the same, correct wall-clock time.
const dateFormatter = new Intl.DateTimeFormat('en', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: INSTITUTION_TIME_ZONE,
});
const timeFormatter = new Intl.DateTimeFormat('en', {
  timeStyle: 'short',
  timeZone: INSTITUTION_TIME_ZONE,
});

function PhotoGallery({ urls, eventTitle }: { urls: string[]; eventTitle: string }) {
  return (
    <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
      {urls.map((url, index) => (
        <li key={url} className="relative aspect-4/3 overflow-hidden rounded-lg bg-muted">
          <Image
            src={url}
            // The admin uploads a file, not a caption, so there is no per-photo alt text to use.
            // Numbering at least distinguishes one photo from the next for a screen-reader user
            // moving through the gallery, instead of five identically-named images.
            alt={`${eventTitle} — photo ${index + 1} of ${urls.length}`}
            fill
            sizes="(min-width: 640px) 33vw, 50vw"
            className="object-cover"
          />
        </li>
      ))}
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

export function EventList({ events }: { events: Event[] }) {
  return (
    <ul className="border-t border-border">
      {events.map((event, index) => (
        <li
          key={event.id}
          style={{ '--i': index } as React.CSSProperties}
          className="rise grid gap-x-8 gap-y-3 border-b border-border py-8 sm:grid-cols-[9rem_1fr] sm:py-10"
        >
          <p className="tabular font-mono text-xs uppercase leading-5 tracking-[0.12em] text-muted-foreground sm:pt-1.5">
            <time dateTime={event.eventDate.toISOString()}>
              {dateFormatter.format(event.eventDate)}
              <span className="sr-only"> at </span>
              <span className="mt-0.5 block text-foreground">
                {timeFormatter.format(event.eventDate)}
              </span>
            </time>
          </p>

          <div className="min-w-0">
            <h3 className="text-balance font-serif text-xl leading-snug text-foreground sm:text-2xl">
              {event.title}
            </h3>
            {/* `whitespace-pre-line` so the paragraph breaks the admin typed into the textarea
                survive to the page. The description is plain text (HTML is stripped at the schema
                boundary), so this is the only structure it can carry. */}
            <p className="mt-3 max-w-[62ch] whitespace-pre-line text-pretty leading-[1.7] text-muted-foreground">
              {event.description}
            </p>

            {event.photoUrls.length > 0 && (
              <PhotoGallery urls={event.photoUrls} eventTitle={event.title} />
            )}
            {event.videoUrls.length > 0 && (
              <VideoList ids={event.videoUrls} eventTitle={event.title} />
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
