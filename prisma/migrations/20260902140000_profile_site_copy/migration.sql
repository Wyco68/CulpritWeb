-- Additive only: six nullable columns on the `profile` singleton. No drops, no rewrites, no
-- backfill. Staging and production share one Supabase database, so this runs against populated
-- data on apply; adding a nullable column with no default is a catalog-only change in Postgres 11+
-- and does not rewrite the table.

-- AlterTable
ALTER TABLE "profile" ADD COLUMN     "appointment_intro" TEXT,
ADD COLUMN     "calendly_url" TEXT,
ADD COLUMN     "events_intro" TEXT,
ADD COLUMN     "publications_intro" TEXT,
ADD COLUMN     "teaching_intro" TEXT,
ADD COLUMN     "team_intro" TEXT;
