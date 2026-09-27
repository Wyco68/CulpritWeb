'use client';

import { useId, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/modules/shared/ui/button';
import { IconButton } from '@/modules/shared/ui/tooltip';
import { Input } from '@/modules/shared/ui/input';
import { Label } from '@/modules/shared/ui/label';
import { parseYouTubeVideoId } from '@/modules/integrations/youtube/youtube-utils';

// The YouTube picker on the event form. Photos use the shared `GalleryField` and `CoverField`.
//
// Videos are deliberately not presented like photos, because the underlying storage differs:
// photos are files this app uploads to R2 and owns, videos are YouTube references it merely
// records. The admin does need to know that removing a video here does not delete anything.

const MAX_VIDEOS = 10;

export function VideoLinkList({
  ids,
  onChange,
  disabled,
}: {
  /** Normalised 11-character YouTube video IDs. */
  ids: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const inputId = useId();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);

  function addDraft() {
    const parsed = parseYouTubeVideoId(draft);
    if (!parsed) {
      setError('Paste a YouTube link or an 11-character video ID.');
      return;
    }
    if (ids.includes(parsed)) {
      setError('That video is already on this event.');
      return;
    }
    if (ids.length >= MAX_VIDEOS) {
      setError(`Up to ${MAX_VIDEOS} videos per event.`);
      return;
    }
    onChange([...ids, parsed]);
    setDraft('');
    setError(undefined);
  }

  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={inputId}>Videos</Label>
      <p className="-mt-0.5 text-xs leading-relaxed text-muted-foreground">
        Optional. Paste a YouTube link — the video is embedded on the public tab, never uploaded or
        stored here. Removing one from this list does not delete it from YouTube.
      </p>

      {ids.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {ids.map((id, index) => (
            <li
              key={id}
              className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
            >
              <a
                href={`https://www.youtube.com/watch?v=${id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate rounded-xs font-mono text-xs text-accent underline-offset-4 hover:underline focus-ring"
              >
                {id}
                <span className="sr-only"> (opens on YouTube in a new tab)</span>
              </a>
              <IconButton
                type="button"
                variant="ghost"
                label={`Remove video ${index + 1}`}
                disabled={disabled}
                className="size-7 shrink-0"
                onClick={() => onChange(ids.filter((candidate) => candidate !== id))}
              >
                <X className="size-3.5" aria-hidden="true" />
              </IconButton>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <Input
          id={inputId}
          value={draft}
          disabled={disabled || ids.length >= MAX_VIDEOS}
          aria-invalid={Boolean(error)}
          aria-describedby={errorId}
          placeholder="https://www.youtube.com/watch?v=…"
          onChange={(event) => {
            setDraft(event.target.value);
            setError(undefined);
          }}
          onKeyDown={(event) => {
            // Enter inside this input must add the video, not submit the whole event form —
            // a half-typed URL would otherwise save the event the moment you pressed Return.
            if (event.key === 'Enter') {
              event.preventDefault();
              addDraft();
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={disabled || draft.trim() === '' || ids.length >= MAX_VIDEOS}
          onClick={addDraft}
        >
          <Plus className="size-4" aria-hidden="true" />
          Add
        </Button>
      </div>

      {error && (
        <p
          id={errorId}
          role="alert"
          aria-live="polite"
          className="text-xs font-medium text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  );
}
