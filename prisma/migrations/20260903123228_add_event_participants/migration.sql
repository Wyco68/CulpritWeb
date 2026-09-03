-- CreateTable
CREATE TABLE "event_participant" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "team_member_id" TEXT,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "photo_url" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_participant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "event_participant_event_id_idx" ON "event_participant"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_participant_event_id_team_member_id_key" ON "event_participant"("event_id", "team_member_id");

-- AddForeignKey
ALTER TABLE "event_participant" ADD CONSTRAINT "event_participant_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_participant" ADD CONSTRAINT "event_participant_team_member_id_fkey" FOREIGN KEY ("team_member_id") REFERENCES "team_member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
