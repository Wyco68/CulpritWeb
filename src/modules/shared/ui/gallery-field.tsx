'use client';

import { useId, useRef, useState } from 'react';
import Image from 'next/image';
import { Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { apiRequest } from '@/modules/shared/lib/api-client';
import { preparePhotoForUpload } from '@/modules/shared/lib/prepare-photo';
import { Button } from '@/modules/shared/ui/button';
import { IconButton } from '@/modules/shared/ui/tooltip';
import { DropZone } from '@/modules/shared/ui/drop-zone';
import { Label } from '@/modules/shared/ui/label';
import { FRAMER_ACCEPTED_TYPES } from '@/modules/shared/ui/photo-framer';

// The admin gallery picker, shared by the event and research forms. Controlled through plain
// value/onChange props so either form can wire it with `setValue` or a `Controller`.
//
// Photos upload whole (ADR-019): no framing step, no crop — the public detail dialog shows every
// photo at its own aspect ratio, so the admin has nothing to decide per photo. The only processing
// is `preparePhotoForUpload`, which scales down a photo too large for the upload route.

/** Upload one photo to `endpoint` and return its public URL. Shared with `CoverField`. */
export async function uploadPhoto(endpoint: string, file: File): Promise<string> {
  const blob = await preparePhotoForUpload(file);
  const formData = new FormData();
  formData.append('file', blob, file.name);
  const { url } = await apiRequest<{ url: string }>(endpoint, { method: 'POST', body: formData });
  return url;
}

export function GalleryField({
  urls,
  onChange,
  endpoint,
  max = 20,
  firstIsCover = false,
  disabled,
}: {
  urls: string[];
  onChange: (next: string[]) => void;
  /** Admin upload route that returns `{ url }`. */
  endpoint: string;
  max?: number;
  /** Badge the first photo as the card cover — true while no dedicated cover is set. */
  firstIsCover?: boolean;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const uploading = progress !== null;

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = ''; // allow re-selecting the same file later
    void acceptFiles(files);
  }

  /** Files picked with the button or dropped on the zone: capped, then uploaded one by one. */
  async function acceptFiles(files: File[]) {
    if (files.length === 0) return;

    const room = max - urls.length;
    if (room <= 0) {
      toast.error(`Up to ${max} photos.`);
      return;
    }
    const selected = files.slice(0, room);
    if (selected.length < files.length) {
      toast.error(`Only the first ${room} photo${room === 1 ? '' : 's'} can be added.`);
    }

    // Sequential rather than parallel: a batch of phone photos in flight at once would contend for
    // the same upstream, and appending as each lands keeps whatever succeeded if a later one fails.
    let next = urls;
    setProgress({ done: 0, total: selected.length });
    for (const [index, file] of selected.entries()) {
      try {
        next = [...next, await uploadPhoto(endpoint, file)];
        onChange(next);
      } catch (error) {
        // Surface the server's own reason (type, size) and carry on with the rest of the batch.
        const reason = error instanceof Error ? error.message : 'Could not upload the photo.';
        toast.error(`${file.name}: ${reason}`);
      }
      setProgress({ done: index + 1, total: selected.length });
    }
    setProgress(null);
  }

  const full = urls.length >= max;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={inputId}>Photos</Label>
      <p className="-mt-0.5 text-xs leading-relaxed text-muted-foreground">
        Optional. JPEG, PNG, WebP or GIF, up to {max}. Photos upload whole and are never cropped in
        the gallery.
      </p>

      <DropZone
        multiple
        onFiles={(files) => void acceptFiles(files)}
        disabled={disabled || uploading || full}
        className="flex flex-col gap-4"
      >
        {urls.length > 0 && (
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {urls.map((url, index) => (
              <li key={url} className="relative">
                {/* `object-contain` on a neutral tile: the thumbnail shows the whole photo, as the
                    public gallery will, rather than implying a crop that isn't applied. */}
                <div className="relative aspect-square overflow-hidden rounded-md bg-muted ring-1 ring-border">
                  <Image
                    src={url}
                    alt={`Photo ${index + 1}`}
                    fill
                    sizes="120px"
                    className="object-contain"
                  />
                  {firstIsCover && index === 0 && (
                    <span className="absolute inset-x-1 bottom-1 rounded-sm bg-foreground/75 px-1.5 py-0.5 text-center text-[11px] font-medium text-background">
                      Card cover
                    </span>
                  )}
                </div>
                <IconButton
                  type="button"
                  variant="outline"
                  label={`Remove photo ${index + 1}`}
                  disabled={disabled || uploading}
                  className="absolute -right-2 -top-2 size-7 rounded-full bg-background"
                  onClick={() => onChange(urls.filter((candidate) => candidate !== url))}
                >
                  <X className="size-3.5" aria-hidden="true" />
                </IconButton>
              </li>
            ))}
          </ul>
        )}

        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            loading={uploading}
            disabled={disabled || full}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="size-4" aria-hidden="true" />
            {uploading
              ? `Uploading ${progress.done + 1} of ${progress.total}…`
              : urls.length > 0
                ? 'Add more photos'
                : 'Upload photos'}
          </Button>
          <span className="ml-3 text-xs text-muted-foreground max-sm:hidden">
            or drag photos here
          </span>
        </div>
      </DropZone>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        multiple
        accept={FRAMER_ACCEPTED_TYPES}
        className="sr-only"
        onChange={handleFileChange}
      />
    </div>
  );
}
