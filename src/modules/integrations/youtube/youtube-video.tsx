'use client';

import { VideoOff } from 'lucide-react';
import { cn } from '@/modules/shared/lib/utils';
import { parseYouTubeVideoId } from './youtube-utils';

export interface YouTubeVideoProps {
  /** A bare 11-character YouTube video ID, or a full YouTube/`youtu.be` URL. Validated at render time. */
  videoId: string;
  /**
   * Accessible name for the iframe. Required — screen reader users need real context for what
   * the embedded video is, so no generic default is provided here.
   */
  title: string;
  className?: string;
}

/**
 * Presentational YouTube embed: a responsive 16:9 iframe pointed at the privacy-enhanced
 * `youtube-nocookie.com` domain. No video files are stored or proxied locally. Renders a
 * graceful empty state (matching `CalendlyEmbed`'s pattern) instead of crashing when `videoId`
 * doesn't resolve to a valid video.
 */
export function YouTubeVideo({ videoId, title, className }: YouTubeVideoProps) {
  const resolvedId = parseYouTubeVideoId(videoId);

  if (!resolvedId) {
    return (
      <div
        role="status"
        className={cn(
          'flex flex-col items-start gap-2 rounded-lg border border-border bg-muted/50 px-7 py-12',
          className,
        )}
      >
        <VideoOff className="mb-1 size-5 text-muted-foreground" aria-hidden="true" />
        <p className="font-serif text-lg text-foreground">This video didn&apos;t load</p>
        <p className="max-w-[58ch] text-pretty text-sm leading-relaxed text-muted-foreground">
          It may have been removed, or made private by whoever uploaded it.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('aspect-video w-full overflow-hidden rounded-lg bg-muted', className)}>
      <iframe
        className="size-full"
        src={`https://www.youtube-nocookie.com/embed/${resolvedId}`}
        title={title}
        loading="lazy"
        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
    </div>
  );
}
