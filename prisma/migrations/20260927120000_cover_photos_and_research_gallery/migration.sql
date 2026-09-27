-- Card covers for events and research, and a gallery for research works (2026-09-27, ADR-019).
--
-- Additive only, so the code already deployed keeps working against the shared database:
-- * `cover_photo_url` on event — an optional dedicated cover. Without one the card uses the first
--   gallery photo, as it always has.
-- * `cover_crop` on both — how the cover is framed on the 3:2 card, as fractions of the source
--   image. Null means "centre it", which is what every card did before.
-- * `photo_urls` on research — the gallery shown in the new detail dialog. The existing
--   `research.photo_url` becomes the research cover in place; its photos were already cut to the
--   card's 3:2 shape at upload, so they need no crop.

-- AlterTable
ALTER TABLE "event" ADD COLUMN "cover_photo_url" TEXT,
ADD COLUMN "cover_crop" JSONB;

-- AlterTable
ALTER TABLE "research" ADD COLUMN "photo_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "cover_crop" JSONB;
