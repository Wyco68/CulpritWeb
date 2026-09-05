'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Check, Loader2, Upload, X, ZoomIn } from 'lucide-react';
import { toast } from 'sonner';
import { apiRequest } from '@/modules/shared/lib/api-client';
import { Avatar } from '@/modules/shared/ui/avatar';
import { Button } from '@/modules/shared/ui/button';
import { Label } from '@/modules/shared/ui/label';

// The file-picker photo control, shared by the profile form and the team-member dialog. Both need
// the identical behaviour — pick a file, frame it, upload it out-of-band, write the resulting URL
// into the surrounding form — so the mechanics live here once and each caller supplies its own
// endpoint and form wiring. Deliberately controlled and form-library-agnostic: it takes a value
// and an onChange, so a caller using `useFormContext` and one using a plain `useForm` both fit.
//
// Picking a file opens a framing step rather than uploading immediately. Every photo here is
// rendered into a square avatar, and an uncropped portrait gets centre-cropped by `object-cover`
// with no say in which part survives — heads ended up out of frame. The admin now chooses, and the
// square that gets uploaded is exactly the square that will be displayed.

const ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp,image/gif';

/** Edge of the uploaded square, in px. Twice the largest place an avatar is rendered (128px). */
const OUTPUT_SIZE = 512;
/** Edge of the on-screen framing viewport, in px. */
const VIEWPORT = 224;
const MAX_ZOOM = 3;

async function uploadPhoto(endpoint: string, file: Blob, filename: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', file, filename);
  const { url } = await apiRequest<{ url: string }>(endpoint, { method: 'POST', body: formData });
  return url;
}

type Pending = { src: string; width: number; height: number };

export interface PhotoUploadProps {
  /** Current photo URL, or null/undefined when there is none. */
  value: string | null | undefined;
  /**
   * Receives the new URL, or `null` when the photo is removed. `null` rather than `undefined` is
   * deliberate: these forms serialize to JSON, where an undefined key simply vanishes from the
   * body — which the update routes read as "leave the column alone", so a removal would silently
   * do nothing.
   */
  onChange: (url: string | null) => void;
  /** Admin upload route that returns `{ url }`. */
  endpoint: string;
  /** Name the photo depicts — used for the preview's alt text and initials fallback. */
  personName?: string;
  label?: string;
  /** `sm:col-span-2` in the two-column profile form; the dialog uses the default single column. */
  className?: string;
}

export function PhotoUpload({
  value,
  onChange,
  endpoint,
  personName = '',
  label = 'Photo',
  className,
}: PhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const inputId = useId();

  const initials = personName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  // Object URLs are a resource, not a string — revoked when the framing step ends so selecting
  // several photos in a row doesn't leak one blob per attempt.
  useEffect(() => {
    return () => {
      if (pending) URL.revokeObjectURL(pending.src);
    };
  }, [pending]);

  /** Display px per source px at zoom 1: the scale that just covers the square viewport. */
  const baseScale = pending ? VIEWPORT / Math.min(pending.width, pending.height) : 1;

  /**
   * Keep the image covering the viewport. Without this the photo can be dragged away from the
   * frame, leaving transparent edges that then get baked into the upload.
   */
  const clamp = useCallback(
    (next: { x: number; y: number }, atZoom: number) => {
      if (!pending) return next;
      const scale = baseScale * atZoom;
      const limitX = Math.max(0, (pending.width * scale - VIEWPORT) / 2);
      const limitY = Math.max(0, (pending.height * scale - VIEWPORT) / 2);
      return {
        x: Math.min(limitX, Math.max(-limitX, next.x)),
        y: Math.min(limitY, Math.max(-limitY, next.y)),
      };
    },
    [pending, baseScale],
  );

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ''; // allow re-selecting the same file later
    if (!file) return;

    const src = URL.createObjectURL(file);
    const probe = new Image();
    probe.onload = () => {
      setPending({ src, width: probe.naturalWidth, height: probe.naturalHeight });
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    };
    probe.onerror = () => {
      URL.revokeObjectURL(src);
      toast.error('That file could not be read as an image.');
    };
    probe.src = src;
  }

  function cancelFraming() {
    if (pending) URL.revokeObjectURL(pending.src);
    setPending(null);
  }

  async function confirmFraming() {
    const image = imageRef.current;
    if (!pending || !image) return;

    setUploading(true);
    try {
      // The visible frame, converted back to source-pixel coordinates. `left`/`top` are where the
      // scaled image sits relative to the viewport's origin, so negating them gives the crop box.
      const scale = baseScale * zoom;
      const left = VIEWPORT / 2 - (pending.width * scale) / 2 + offset.x;
      const top = VIEWPORT / 2 - (pending.height * scale) / 2 + offset.y;

      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas unavailable');
      ctx.drawImage(
        image,
        -left / scale,
        -top / scale,
        VIEWPORT / scale,
        VIEWPORT / scale,
        0,
        0,
        OUTPUT_SIZE,
        OUTPUT_SIZE,
      );

      const blob = await new Promise<Blob | null>((resolve) =>
        // JPEG at 0.9: the output is a square portrait, and re-encoding PNG screenshots as PNG was
        // producing multi-megabyte uploads that hit the route's 4 MB cap.
        canvas.toBlob(resolve, 'image/jpeg', 0.9),
      );
      if (!blob) throw new Error('encode failed');

      onChange(await uploadPhoto(endpoint, blob, 'photo.jpg'));
      cancelFraming();
    } catch {
      toast.error('Could not upload the photo. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  function startDrag(event: React.PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX - offset.x, y: event.clientY - offset.y };
  }

  function onDrag(event: React.PointerEvent<HTMLDivElement>) {
    const start = dragRef.current;
    if (!start) return;
    setOffset(clamp({ x: event.clientX - start.x, y: event.clientY - start.y }, zoom));
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
  }

  /** Arrow keys nudge the frame, so this is not drag-only. */
  function nudge(event: React.KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 20 : 5;
    const moves: Record<string, { x: number; y: number }> = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    setOffset((current) => clamp({ x: current.x + move.x, y: current.y + move.y }, zoom));
  }

  if (pending) {
    const scale = baseScale * zoom;
    return (
      <div className={className}>
        <div className="flex flex-col gap-3">
          <Label>Frame the photo</Label>
          <div
            role="application"
            aria-label="Drag to reposition, or use the arrow keys. Adjust the zoom slider to scale."
            tabIndex={0}
            onPointerDown={startDrag}
            onPointerMove={onDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onKeyDown={nudge}
            style={{ width: VIEWPORT, height: VIEWPORT }}
            className="relative cursor-grab touch-none overflow-hidden rounded-lg border border-border-strong bg-muted active:cursor-grabbing focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL being
                measured and drawn to a canvas; next/image would neither optimise nor allow it. */}
            <img
              ref={imageRef}
              src={pending.src}
              alt=""
              draggable={false}
              style={{
                position: 'absolute',
                left: VIEWPORT / 2 - (pending.width * scale) / 2 + offset.x,
                top: VIEWPORT / 2 - (pending.height * scale) / 2 + offset.y,
                width: pending.width * scale,
                height: pending.height * scale,
                maxWidth: 'none',
              }}
            />
          </div>

          <div className="flex items-center gap-3" style={{ width: VIEWPORT }}>
            <ZoomIn className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              type="range"
              min={1}
              max={MAX_ZOOM}
              step={0.01}
              value={zoom}
              aria-label="Zoom"
              onChange={(e) => {
                const next = Number(e.target.value);
                setZoom(next);
                setOffset((current) => clamp(current, next));
              }}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-pill bg-muted accent-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            />
          </div>

          <div className="flex gap-2">
            <Button size="sm" loading={uploading} onClick={confirmFraming}>
              <Check className="size-4" aria-hidden="true" />
              Use photo
            </Button>
            <Button size="sm" variant="outline" disabled={uploading} onClick={cancelFraming}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex flex-col gap-2">
        <Label htmlFor={inputId}>{label}</Label>
        <div className="flex items-center gap-4">
          <Avatar
            src={value}
            alt={personName ? `Portrait of ${personName}` : 'Photo preview'}
            fallback={initials || '?'}
            size="lg"
          />
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading}
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
                {value ? 'Change photo' : 'Upload photo'}
              </Button>
              {value && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  onClick={() => onChange(null)}
                >
                  <X className="size-4" aria-hidden="true" />
                  Remove
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">JPEG, PNG, WebP or GIF. 4 MB max.</p>
          </div>
        </div>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={ACCEPTED_TYPES}
          className="sr-only"
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
}
