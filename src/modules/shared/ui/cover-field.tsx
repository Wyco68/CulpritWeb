'use client';

import { useId, useRef, useState } from 'react';
import { Check, Crop, ImageUp, RotateCcw, X } from 'lucide-react';
import { toast } from 'sonner';
import { COVER_ASPECT, resolveCover, type CoverSource } from '@/modules/shared/lib/cover-crop';
import { Button } from '@/modules/shared/ui/button';
import { CardPhoto } from '@/modules/shared/ui/card-photo';
import { DropZone } from '@/modules/shared/ui/drop-zone';
import { Label } from '@/modules/shared/ui/label';
import {
  CropViewport,
  FRAMER_ACCEPTED_TYPES,
  type CropRect,
} from '@/modules/shared/ui/photo-framer';
import { uploadPhoto } from '@/modules/shared/ui/gallery-field';

// The card-cover control, shared by the event and research forms (ADR-019).
//
// The cover is the dedicated photo when one is uploaded, otherwise the first gallery photo. Either
// way it is stored uncropped and framed by a rectangle the admin can re-open and move at any time
// — "Adjust crop" never re-uploads anything. Uploading a new cover goes straight into that editor,
// since a fresh photo almost always needs framing for a 3:2 card.

export type CoverValue = Pick<CoverSource, 'coverPhotoUrl' | 'coverCrop'>;

export function CoverField({
  coverPhotoUrl,
  coverCrop,
  photoUrls,
  onChange,
  endpoint,
  disabled,
}: CoverSource & {
  /** Receives both fields together, so a new cover can never keep the old cover's crop. */
  onChange: (next: CoverValue) => void;
  /** Admin upload route that returns `{ url }`. */
  endpoint: string;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(false);
  // The rectangle the editor currently shows; committed to the form only on "Save crop".
  const draftRef = useRef<CropRect | null>(null);

  const { src, crop } = resolveCover({ coverPhotoUrl, coverCrop, photoUrls });

  async function uploadCover(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadPhoto(endpoint, file);
      onChange({ coverPhotoUrl: url, coverCrop: null });
      setEditing(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not upload the cover.');
    } finally {
      setUploading(false);
    }
  }

  function saveCrop() {
    const rect = draftRef.current;
    if (src && rect) onChange({ coverPhotoUrl, coverCrop: { url: src, ...rect } });
    setEditing(false);
  }

  if (editing && src) {
    return (
      <div className="flex flex-col gap-3">
        <Label>Frame the card cover</Label>
        <p className="-mt-2 text-xs text-muted-foreground">
          Only the card is cropped. The photo itself is kept whole.
        </p>
        <CropViewport
          src={src}
          aspect={COVER_ASPECT}
          initialCrop={crop}
          onChange={(rect) => {
            draftRef.current = rect;
          }}
          onError={() => {
            toast.error('That photo could not be loaded.');
            setEditing(false);
          }}
        />
        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={saveCrop}>
            <Check className="size-4" aria-hidden="true" />
            Save crop
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  const status = coverPhotoUrl
    ? 'A dedicated cover photo.'
    : src
      ? 'Using the first gallery photo. Upload a cover to use a different one.'
      : 'No photo yet — the card shows a pattern until you add a cover or a gallery photo.';

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={inputId}>Cover</Label>
      <DropZone onFiles={([file]) => void uploadCover(file)} disabled={disabled || uploading}>
        <div className="flex flex-wrap items-start gap-4">
          <CardPhoto
            src={src}
            crop={crop}
            className="w-52 shrink-0 rounded-lg border border-border-strong"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <p className="text-xs leading-relaxed text-muted-foreground">
              {status}
              {src && (crop ? ' Cropped by hand.' : ' Centred automatically.')}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                loading={uploading}
                disabled={disabled}
                onClick={() => inputRef.current?.click()}
              >
                <ImageUp className="size-4" aria-hidden="true" />
                {coverPhotoUrl ? 'Replace cover' : 'Upload cover'}
              </Button>
              {src && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disabled || uploading}
                  onClick={() => setEditing(true)}
                >
                  <Crop className="size-4" aria-hidden="true" />
                  Adjust crop
                </Button>
              )}
              {crop && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={disabled || uploading}
                  onClick={() => onChange({ coverPhotoUrl, coverCrop: null })}
                >
                  <RotateCcw className="size-4" aria-hidden="true" />
                  Reset crop
                </Button>
              )}
              {coverPhotoUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={disabled || uploading}
                  onClick={() => onChange({ coverPhotoUrl: null, coverCrop: null })}
                >
                  <X className="size-4" aria-hidden="true" />
                  {photoUrls.length > 0 ? 'Use first photo instead' : 'Remove cover'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DropZone>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={FRAMER_ACCEPTED_TYPES}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = ''; // allow re-selecting the same file later
          void uploadCover(file);
        }}
      />
    </div>
  );
}
