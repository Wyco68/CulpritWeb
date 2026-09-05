'use client';

import { useId, useRef, useState } from 'react';
import Image from 'next/image';
import { Loader2, Plus, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { apiRequest } from '@/modules/shared/lib/api-client';
import { Button } from '@/modules/shared/ui/button';
import { Input } from '@/modules/shared/ui/input';
import { Label } from '@/modules/shared/ui/label';
import { parseYouTubeVideoId } from '@/modules/integrations/youtube/youtube-utils';

// The two media pickers on the event form. Both are controlled from the dialog's RHF state via
// plain value/onChange props rather than `useFormContext` — the dialog is a single self-contained
// form and threading a provider through it for two fields would be ceremony.
//
// The photo and video halves are deliberately asymmetric, because the underlying storage is:
// photos are files this app uploads to R2 and owns, videos are YouTube references it merely
// records. Presenting them as one uniform "media" widget would hide that difference from the
// admin, who does need to know that removing a video here does not delete anything anywhere.

const ACCEPTED_IMAGE_TYPES = 'image/jpeg,image/png,image/webp,image/gif';
const MAX_PHOTOS = 20;
const MAX_VIDEOS = 10;

// Kept in step with the server's own cap (modules/integrations/storage/uploaded-photo.ts). A phone
// photo is routinely 5–12 MB, well over this, which is the single most common reason an upload was
// rejected with a 400 before `prepareForUpload` shrank it here.
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
// Longest edge kept after downscale. A public gallery tile is a few hundred px; 2000 leaves plenty
// of headroom for a full-bleed view without shipping a 6000px original.
const MAX_EDGE = 2000;

/**
 * Downscale and re-encode a photo to a JPEG that fits under the route's size cap, so the admin can
 * pick a photo straight off a phone or camera rather than having to shrink it by hand first.
 *
 * Only touches files that actually need it — one already small and in an accepted format is sent
 * untouched, so a deliberately-chosen PNG or GIF is not silently flattened. Anything the browser
 * cannot decode (a HEIC straight off an iPhone, in every browser but Safari) can't be drawn to a
 * canvas at all; that falls through to the original file, and the server answers with its own
 * "Unsupported file type" message rather than this swallowing the problem.
 */
async function prepareForUpload(file: File): Promise<File> {
  const accepted = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
  if (accepted.has(file.type) && file.size <= MAX_UPLOAD_BYTES) return file;

  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      // `window.Image`, not `new Image()`: this module imports `next/image` as `Image`, so the bare
      // constructor would resolve to that component instead of the DOM image element.
      const img = new window.Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('decode failed'));
      img.src = url;
    });

    const scale = Math.min(1, MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.85),
    );
    // If the re-encode somehow lands larger than the original (already-optimised small JPEG), keep
    // whichever is smaller; never send back something bigger than what we started with.
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], 'photo.jpg', { type: 'image/jpeg' });
  } catch {
    // Undecodable (e.g. HEIC): hand back the original and let the server validate it.
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function uploadEventPhoto(file: File): Promise<string> {
  const prepared = await prepareForUpload(file);
  const formData = new FormData();
  formData.append('file', prepared);
  const { url } = await apiRequest<{ url: string }>('/api/admin/events/photo', {
    method: 'POST',
    body: formData,
  });
  return url;
}

export function PhotoUploadList({
  urls,
  onChange,
  disabled,
}: {
  urls: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [uploading, setUploading] = useState(false);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = ''; // allow re-selecting the same file later
    if (files.length === 0) return;

    const room = MAX_PHOTOS - urls.length;
    if (room <= 0) {
      toast.error(`Up to ${MAX_PHOTOS} photos per event.`);
      return;
    }
    const selected = files.slice(0, room);
    if (selected.length < files.length) {
      toast.error(`Only the first ${room} photo${room === 1 ? '' : 's'} were added.`);
    }

    setUploading(true);
    try {
      // Sequential, not Promise.all: these are multi-megabyte uploads from one admin's browser,
      // and firing ten at once mostly succeeds in making all ten slower. Each URL is appended as
      // it lands, so a failure part-way through keeps whatever already uploaded.
      const uploaded: string[] = [];
      for (const file of selected) {
        uploaded.push(await uploadEventPhoto(file));
      }
      onChange([...urls, ...uploaded]);
    } catch (error) {
      // Surface the server's own reason ("Unsupported file type", "Photo is too large") rather
      // than a generic line, so the admin knows whether to convert the file or pick another.
      toast.error(error instanceof Error ? error.message : 'Could not upload the photo.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={inputId}>Photos</Label>
      <p className="-mt-0.5 text-xs leading-relaxed text-muted-foreground">
        Optional. JPEG, PNG, WebP or GIF, 4 MB each, up to {MAX_PHOTOS} per event. They appear as a
        gallery under the event on the public tab.
      </p>

      {urls.length > 0 && (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {urls.map((url, index) => (
            <li key={url} className="relative">
              <div className="relative aspect-4/3 overflow-hidden rounded-md bg-muted ring-1 ring-border">
                <Image
                  src={url}
                  alt={`Photo ${index + 1}`}
                  fill
                  sizes="120px"
                  className="object-cover"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={`Remove photo ${index + 1}`}
                disabled={disabled || uploading}
                className="absolute -right-2 -top-2 size-7 rounded-full bg-background"
                onClick={() => onChange(urls.filter((candidate) => candidate !== url))}
              >
                <X className="size-3.5" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || uploading || urls.length >= MAX_PHOTOS}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <Loader2
              className="size-4 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : (
            <Upload className="size-4" aria-hidden="true" />
          )}
          {urls.length > 0 ? 'Add more photos' : 'Upload photos'}
        </Button>
      </div>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        multiple
        accept={ACCEPTED_IMAGE_TYPES}
        className="sr-only"
        onChange={handleFileChange}
      />
    </div>
  );
}

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
                className="truncate rounded-xs font-mono text-xs text-accent underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {id}
                <span className="sr-only"> (opens on YouTube in a new tab)</span>
              </a>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove video ${index + 1}`}
                disabled={disabled}
                className="size-7 shrink-0"
                onClick={() => onChange(ids.filter((candidate) => candidate !== id))}
              >
                <X className="size-3.5" aria-hidden="true" />
              </Button>
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
