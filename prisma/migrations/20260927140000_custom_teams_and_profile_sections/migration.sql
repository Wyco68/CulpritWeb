-- Admin-defined teams and per-member profile sections (2026-09-27, ADR-020).
--
-- Replaces the fixed `TeamKind` enum and its hard-coded per-team rules. Additive only, because the
-- database is shared with the deployed app, which still reads `team_member.team_kind`:
-- * a `team` table the admin manages (name + position), and `team_member.team_id` pointing at it;
-- * `team_member.hidden_sections` — the profile sections switched off for that member;
-- * `team_member.team_kind` loses its NOT NULL, since new members no longer get one. The column and
--   the `TeamKind` type are dropped in a follow-up once this deploy is live.
--
-- The backfill reproduces today's pages exactly: each existing team becomes a row, and each
-- member's hidden sections are what their team's rules used to withhold.

-- CreateEnum
CREATE TYPE "ProfileSection" AS ENUM ('research_interest', 'publications', 'research', 'projects', 'education', 'invited_talk', 'fellowship', 'scholarship', 'courses', 'teaching_role', 'teaching_award');

-- CreateTable
CREATE TABLE "team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "team_name_key" ON "team"("name");

-- AlterTable
ALTER TABLE "team_member" ADD COLUMN "team_id" TEXT,
ADD COLUMN "hidden_sections" "ProfileSection"[] DEFAULT ARRAY[]::"ProfileSection"[],
ALTER COLUMN "team_kind" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "team_member_team_id_idx" ON "team_member"("team_id");

-- AddForeignKey
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: one team row per team that has members, in the old fixed display order. The director
-- is featured on their own, so the `director` kind becomes no team at all.
INSERT INTO "team" ("id", "name", "sort_order", "updated_at")
SELECT v.id, v.name, v.sort_order, CURRENT_TIMESTAMP
FROM (VALUES
    ('team_professor', 'Professors', 1, 'professor'),
    ('team_research', 'Research Team', 2, 'research'),
    ('team_development', 'Development Team', 3, 'development')
) AS v (id, name, sort_order, kind)
WHERE EXISTS (SELECT 1 FROM "team_member" m WHERE m."team_kind"::text = v.kind);

UPDATE "team_member"
SET "team_id" = 'team_' || "team_kind"::text
WHERE "team_kind" IN ('professor', 'research', 'development');

-- Backfill: hide what each old team could not have (the rules table in the deleted
-- shared/lib/team-kind.ts). Director and professor could have everything.
UPDATE "team_member"
SET "hidden_sections" = ARRAY['education', 'fellowship', 'scholarship', 'invited_talk', 'teaching_role', 'teaching_award', 'courses']::"ProfileSection"[]
WHERE "team_kind" = 'research';

UPDATE "team_member"
SET "hidden_sections" = ARRAY['research_interest', 'education', 'fellowship', 'scholarship', 'invited_talk', 'teaching_role', 'teaching_award', 'courses', 'research', 'publications']::"ProfileSection"[]
WHERE "team_kind" = 'development';
