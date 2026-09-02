-- CV entries and courses.
--
-- Seven Json columns on `profile` become rows in `cv_entry`, and a new `course` table backs the
-- Teaching tab. Order matters: the table must exist before the Json can be copied into it, and the
-- columns must not be dropped until that copy has succeeded.

-- CreateEnum
CREATE TYPE "CvSection" AS ENUM ('education', 'fellowship', 'scholarship', 'research_interest', 'invited_talk', 'teaching_role', 'teaching_award');

-- CreateTable
CREATE TABLE "cv_entry" (
    "id" TEXT NOT NULL,
    "section" "CvSection" NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "year" TEXT,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cv_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "title" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "term" TEXT,
    "description" TEXT,
    "link" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cv_entry_section_sort_order_idx" ON "cv_entry"("section", "sort_order");
CREATE INDEX "course_sort_order_idx" ON "course"("sort_order");

-- Backfill: lift each Json list into `cv_entry`, preserving the order the admin arranged it in
-- (array position becomes `sort_order`). `title` is the only required field in the old list-item
-- shape, so entries with a blank or missing title are skipped rather than inserted as empty rows.
-- `gen_random_uuid()` is built into PostgreSQL 13+, which Supabase is well past.
INSERT INTO "cv_entry" ("id", "section", "title", "subtitle", "year", "description", "sort_order", "created_at", "updated_at")
SELECT
    gen_random_uuid()::text,
    source.section,
    entry.item ->> 'title',
    NULLIF(entry.item ->> 'subtitle', ''),
    NULLIF(entry.item ->> 'year', ''),
    NULLIF(entry.item ->> 'description', ''),
    (entry.ord - 1)::int,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "profile" p
CROSS JOIN LATERAL (
    VALUES
        (p."education",                  'education'::"CvSection"),
        (p."fellowships_visiting",       'fellowship'::"CvSection"),
        (p."scholarships_travel_awards", 'scholarship'::"CvSection"),
        (p."research_interests",         'research_interest'::"CvSection"),
        (p."invited_talks",              'invited_talk'::"CvSection"),
        (p."teaching_roles",             'teaching_role'::"CvSection"),
        (p."teaching_awards",            'teaching_award'::"CvSection")
) AS source(payload, section)
CROSS JOIN LATERAL jsonb_array_elements(source.payload) WITH ORDINALITY AS entry(item, ord)
WHERE jsonb_typeof(source.payload) = 'array'
  AND COALESCE(entry.item ->> 'title', '') <> '';

-- AlterTable — the Json has been copied out, so the columns go. This is the destructive step:
-- there is no down path, and the copy above is the only thing standing between the old content
-- and losing it.
ALTER TABLE "profile" DROP COLUMN "education",
DROP COLUMN "fellowships_visiting",
DROP COLUMN "scholarships_travel_awards",
DROP COLUMN "research_interests",
DROP COLUMN "invited_talks",
DROP COLUMN "teaching_roles",
DROP COLUMN "teaching_awards";
