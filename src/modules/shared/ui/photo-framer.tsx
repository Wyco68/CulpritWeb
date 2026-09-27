'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ZoomIn } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/modules/shared/ui/button';
import { Label } from '@/modules/shared/ui/label';

// The drag-and-zoom framing step. Two users:
//
// * `PhotoFramer` — portraits (the profile form and the team-member dialog, via `PhotoUpload`).
//   A portrait is displayed inside a square avatar, and an unframed one gets centre-cropped by
//   `object-cover` with no say in which part survives, so heads end up out of frame. The admin
//   picks the square instead, and the square that gets uploaded is exactly the square displayed.
//   Framing also doubles as the downscale step: the canvas output is always `outputSize` square,
//   re-encoded as JPEG, which lands far under the routes' 4 MB cap however large the original was.
//
// * The card-cover editor (`CoverField`) — which frames an already-uploaded photo without touching
//   its pixels: it keeps only the rectangle and the card applies it at render time (ADR-019).
//
// Both are built on `CropViewport`, which reports the framed area as fractions of the source image.

export const FRAMER_ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp,image/gif';

/** Edge of the on-screen framing viewport for a square frame, in px. */
const VIEWPORT = 224;
/** Width of the viewport for a landscape frame — still fits a 320px phone inside the dialog. */
const WIDE_VIEWPORT = 272;
const MAX_ZOOM = 3;

/** The framed area, in fractions (0–1) of the source image's width and height. */
export type CropRect = { x: number; y: number; width: number; height: number };

export type Size = { width: number; height: number };

export interface CropViewportProps {
  /** Image to frame — an object URL for a picked file, or an uploaded photo's public URL. */
  src: string;
  /** Width ÷ height of the frame. */
  aspect: number;
  /** Where to start. Omitted, the frame starts centred at the widest zoom. */
  initialCrop?: CropRect | null;
  /** Called whenever the framing changes, and once when the image has loaded. */
  onChange: (crop: CropRect) => void;
  /** The decoded image, e.g. to draw the framed area to a canvas. */
  onLoad?: (image: HTMLImageElement) => void;
  onError?: () => void;
}

/** On-screen frame size for an aspect: squares stay 224px, landscapes widen rather than shrink. */
function frameSize(aspect: number): Size {
  const width = aspect > 1 ? WIDE_VIEWPORT : VIEWPORT * aspect;
  return { width, height: width / aspect };
}

// The framing maths, kept pure so the round trip the cover editor depends on — save a crop, reopen
// the editor, see the same frame — is testable without a browser. `frame` is the on-screen
// viewport and `size` the source image, both in px; `offset` is how far the image's centre has
// been dragged from the viewport's centre.

type Offset = { x: number; y: number };

/** Display px per source px at zoom 1: the scale that just covers the frame. */
export function baseScale(frame: Size, size: Size): number {
  return Math.max(frame.width / size.width, frame.height / size.height);
}

/**
 * Keep the image covering the viewport. Without this the photo can be dragged away from the frame,
 * leaving empty edges inside the crop.
 */
export function clampOffset(frame: Size, size: Size, offset: Offset, zoom: number): Offset {
  const scale = baseScale(frame, size) * zoom;
  const limitX = Math.max(0, (size.width * scale - frame.width) / 2);
  const limitY = Math.max(0, (size.height * scale - frame.height) / 2);
  return {
    x: Math.min(limitX, Math.max(-limitX, offset.x)),
    y: Math.min(limitY, Math.max(-limitY, offset.y)),
  };
}

/** The visible frame, converted to fractions of the source image. */
export function viewToCrop(frame: Size, size: Size, zoom: number, offset: Offset): CropRect {
  const scale = baseScale(frame, size) * zoom;
  // Where the scaled image's corner sits relative to the viewport's; negated, the crop's corner.
  const left = frame.width / 2 - (size.width * scale) / 2 + offset.x;
  const top = frame.height / 2 - (size.height * scale) / 2 + offset.y;
  return {
    x: -left / scale / size.width,
    y: -top / scale / size.height,
    width: frame.width / scale / size.width,
    height: frame.height / scale / size.height,
  };
}

/** The inverse of `viewToCrop`: the zoom and offset that show `crop`, within the editor's limits. */
export function cropToView(
  frame: Size,
  size: Size,
  crop: CropRect,
): { zoom: number; offset: Offset } {
  const base = baseScale(frame, size);
  const zoom = Math.min(MAX_ZOOM, Math.max(1, frame.width / (crop.width * size.width) / base));
  const scale = base * zoom;
  const offset = {
    x: -crop.x * size.width * scale - frame.width / 2 + (size.width * scale) / 2,
    y: -crop.y * size.height * scale - frame.height / 2 + (size.height * scale) / 2,
  };
  return { zoom, offset: clampOffset(frame, size, offset, zoom) };
}

export function CropViewport({
  src,
  aspect,
  initialCrop,
  onChange,
  onLoad,
  onError,
}: CropViewportProps) {
  const frame = frameSize(aspect);
  const [source, setSource] = useState<Size | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number } | null>(null);

  function apply(size: Size, atZoom: number, at: { x: number; y: number }) {
    setZoom(atZoom);
    setOffset(at);
    onChange(viewToCrop(frame, size, atZoom, at));
  }

  useEffect(() => {
    let live = true;
    const probe = new window.Image();
    probe.onload = () => {
      if (!live) return;
      const size = { width: probe.naturalWidth, height: probe.naturalHeight };
      setSource(size);
      const start = initialCrop
        ? cropToView(frame, size, initialCrop)
        : { zoom: 1, offset: { x: 0, y: 0 } };
      apply(size, start.zoom, start.offset);
      onLoad?.(probe);
    };
    probe.onerror = () => {
      if (live) onError?.();
    };
    probe.src = src;
    return () => {
      live = false;
    };
    // Keyed on the image only: callers pass inline callbacks and a fresh `initialCrop` object on
    // every render, and re-running this would reset the framing the admin is in the middle of.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  function startDrag(event: React.PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX - offset.x, y: event.clientY - offset.y };
  }

  function onDrag(event: React.PointerEvent<HTMLDivElement>) {
    const start = dragRef.current;
    if (!start || !source) return;
    apply(
      source,
      zoom,
      clampOffset(frame, source, { x: event.clientX - start.x, y: event.clientY - start.y }, zoom),
    );
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
    if (!move || !source) return;
    event.preventDefault();
    apply(
      source,
      zoom,
      clampOffset(frame, source, { x: offset.x + move.x, y: offset.y + move.y }, zoom),
    );
  }

  const scale = source ? baseScale(frame, source) * zoom : 1;

  return (
    <div className="flex flex-col gap-3">
      <div
        role="application"
        aria-label="Drag to reposition, or use the arrow keys. Adjust the zoom slider to scale."
        tabIndex={0}
        onPointerDown={startDrag}
        onPointerMove={onDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={nudge}
        style={{ width: frame.width, height: frame.height }}
        className="relative cursor-grab touch-none overflow-hidden rounded-lg border border-border-strong bg-muted active:cursor-grabbing focus-ring"
      >
        {source && (
          /* eslint-disable-next-line @next/next/no-img-element -- positioned and scaled by hand to
             match the crop maths; next/image would neither optimise a blob URL nor allow this. */
          <img
            src={src}
            alt=""
            draggable={false}
            style={{
              position: 'absolute',
              left: frame.width / 2 - (source.width * scale) / 2 + offset.x,
              top: frame.height / 2 - (source.height * scale) / 2 + offset.y,
              width: source.width * scale,
              height: source.height * scale,
              maxWidth: 'none',
            }}
          />
        )}
      </div>

      <div className="flex items-center gap-3" style={{ width: frame.width }}>
        <ZoomIn className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          type="range"
          min={1}
          max={MAX_ZOOM}
          step={0.01}
          value={zoom}
          aria-label="Zoom"
          disabled={!source}
          onChange={(e) => {
            if (!source) return;
            const next = Number(e.target.value);
            apply(source, next, clampOffset(frame, source, offset, next));
          }}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-pill bg-muted accent-accent focus-ring"
        />
      </div>
    </div>
  );
}

export interface PhotoFramerProps {
  /** The picked file. Decoded here; an undecodable one is reported and cancelled. */
  file: File;
  /** Width of the uploaded image, in px. Its height follows from `aspect`. */
  outputSize: number;
  /** Width ÷ height of the frame and the upload. Defaults to 1 — the square portrait crop. */
  aspect?: number;
  /** Called with the cropped JPEG. May be async — the buttons stay disabled while it settles. */
  onConfirm: (blob: Blob) => void | Promise<void>;
  onCancel: () => void;
  /** Extra context above the frame, e.g. "Photo 2 of 5" when a batch is being framed. */
  caption?: string;
  className?: string;
}

/** Frame a picked file and upload exactly the framed area. */
export function PhotoFramer({
  file,
  outputSize,
  aspect = 1,
  onConfirm,
  onCancel,
  caption,
  className,
}: PhotoFramerProps) {
  const [url, setUrl] = useState<string | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const cropRef = useRef<CropRect | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  // Object URLs are a resource, not a string — revoked when this file's framing ends so picking
  // several photos in a row doesn't leak one blob per attempt.
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    setReady(false);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  async function confirm() {
    const image = imageRef.current;
    const crop = cropRef.current;
    if (!image || !crop) return;

    setBusy(true);
    try {
      const outputHeight = Math.round(outputSize / aspect);
      const canvas = document.createElement('canvas');
      canvas.width = outputSize;
      canvas.height = outputHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas unavailable');
      ctx.drawImage(
        image,
        crop.x * image.naturalWidth,
        crop.y * image.naturalHeight,
        crop.width * image.naturalWidth,
        crop.height * image.naturalHeight,
        0,
        0,
        outputSize,
        outputHeight,
      );

      const blob = await new Promise<Blob | null>((resolve) =>
        // JPEG at 0.9: the output is a photographic crop, and re-encoding PNG screenshots as PNG was
        // producing multi-megabyte uploads that hit the route's 4 MB cap.
        canvas.toBlob(resolve, 'image/jpeg', 0.9),
      );
      if (!blob) throw new Error('encode failed');

      await onConfirm(blob);
    } catch {
      toast.error('Could not upload the photo. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      <div className="flex flex-col gap-3">
        <Label>Frame the photo</Label>
        {caption && <p className="-mt-2 text-xs text-muted-foreground">{caption}</p>}
        {url && (
          <CropViewport
            src={url}
            aspect={aspect}
            onChange={(crop) => {
              cropRef.current = crop;
            }}
            onLoad={(image) => {
              imageRef.current = image;
              setReady(true);
            }}
            onError={() => {
              // Undecodable in this browser (a HEIC straight off an iPhone, everywhere but Safari).
              toast.error('That file could not be read as an image.');
              onCancel();
            }}
          />
        )}

        <div className="flex gap-2">
          <Button size="sm" loading={busy} disabled={!ready} onClick={confirm}>
            <Check className="size-4" aria-hidden="true" />
            Use photo
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
