-- Replace ResearchGroup's embedded CV-style JSON members with a proper relational TeamMember
-- entity, so members can be listed/edited independently (their own public tab + admin CRUD) and
-- optionally attributed to a research group. No production data existed in the JSON column yet
-- (M1 content modules were unbuilt), so this is a structural change, not a data backfill.

-- AlterTable
ALTER TABLE "research_group" DROP COLUMN "members";

-- CreateTable
CREATE TABLE "team_member" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "bio" TEXT,
    "photo_url" TEXT,
    "research_group_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_member_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "team_member_research_group_id_idx" ON "team_member"("research_group_id");

-- AddForeignKey
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_research_group_id_fkey" FOREIGN KEY ("research_group_id") REFERENCES "research_group"("id") ON DELETE SET NULL ON UPDATE CASCADE;
