-- A photo for each research work, shown on the public Research cards (2026-09-26).
--
-- Nullable and additive: existing rows keep working with no photo, and the card falls back to a
-- generated placeholder. Stored as a public R2 URL in the existing `research/` prefix, the same way
-- `team_member.photo_url` stores a member's portrait.

-- AlterTable
ALTER TABLE "research" ADD COLUMN "photo_url" TEXT;
