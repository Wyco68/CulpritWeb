---
status: current
source_of_truth: true
last_updated: 2026-09-27
related_modules: [events, research, shared]
related_decisions: [ADR-011, ADR-018]
---

# ADR-019: Photos are stored uncropped; only card covers are cropped, as data

## Status

Accepted.

## Date

2026-09-27

## Context

Every event photo went through a square framing step before upload, and every research photo
through a 3:2 one. The pixels outside the frame were thrown away, so the event detail gallery —
which shows photos with `object-contain` precisely so none are cut off — could only ever show
squares. A crop, once made, could not be changed without re-uploading the original.

Research works had a single card photo and no detail view, unlike events.

## Decision

- **Gallery photos upload whole.** No framing step. The browser only scales down a photo that is
  over 3.5 MB or longer than 2560 px on its longest edge (`preparePhotoForUpload`), keeping its
  aspect ratio, so it fits under the upload routes' 4 MB cap.
- **The card cover is the only cropped image, and the crop is data.** Events and research works
  each have an optional dedicated `coverPhotoUrl`; without one the first gallery photo is the
  cover. `coverCrop` stores a rectangle over the cover's source image, in fractions of its width
  and height (`shared/lib/cover-crop.ts`). `CardPhoto` applies it with CSS at render time, so the
  admin can re-open "Adjust crop" at any time and nothing is re-uploaded.
- **A crop carries the URL it was drawn on.** The cover's source can change without the crop being
  touched — remove the first gallery photo and the next becomes the cover. `resolveCover` ignores a
  crop whose `url` no longer matches, so a stale rectangle never frames the wrong photo; that card
  falls back to a centred crop.
- **Research gets the event shape**: cover, gallery, and a Show Details dialog carrying the full
  summary, byline, project link and the uncropped gallery. The shared pieces are `PhotoGallery`,
  `GalleryField`, `CoverField` and `CropViewport`.

## Schema

Additive only, because the database is shared with the deployed app
(`20260927120000_cover_photos_and_research_gallery`): `event.cover_photo_url`,
`event.cover_crop`, `research.photo_urls`, `research.cover_crop`. The existing
`research.photo_url` becomes the research cover in place (Prisma field `coverPhotoUrl`); its photos
were already cut to 3:2 at upload, so they need no crop.

## Consequences

- Photos uploaded before this change stay as they were cropped — the originals were never stored.
  Re-upload an event's photos to get them whole in its gallery.
- A zoomed-in cover requests a proportionally wider image from `next/image`, so it stays sharp.
- Portrait photos (profile and team member) still use the square framing step: an avatar is
  always a square, and there is no gallery to show the whole photo in.

## Alternatives considered

- **Crop on the server into a second stored file.** Every re-crop would upload and orphan another
  object in R2, and the crop could still not be reopened on the original without storing the
  rectangle as well.
- **Store the rectangle without the URL** and reset it in the service whenever the cover source
  changes. That puts a read-before-write into every update for a case `resolveCover` handles at
  render time with one comparison.
