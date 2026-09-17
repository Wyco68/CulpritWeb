-- Drop the lab logo: the site header stopped rendering it (PR #21) and nothing else reads it, so
-- the admin field and this column go with it.
--
-- THIS DROPS A COLUMN. Staging and production share one Supabase database — take a backup before
-- this runs anywhere. The uploaded image itself (`profile/avatar` in R2) is not touched.
--
-- `IF EXISTS`: on the shared database the column had already been removed outside Prisma before
-- this migration was recorded, so it must be a no-op there and a real drop anywhere else.

-- AlterTable
ALTER TABLE "profile" DROP COLUMN IF EXISTS "logo_url";
