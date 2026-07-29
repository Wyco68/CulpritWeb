-- Calendly REST integration metadata on the appointment record (association only). The unique
-- index on calendly_invitee_uri enforces webhook idempotency at the DB level (one row per invitee).

-- AlterTable
ALTER TABLE "appointment" ADD COLUMN "calendly_event_uri" TEXT;
ALTER TABLE "appointment" ADD COLUMN "calendly_invitee_uri" TEXT;
ALTER TABLE "appointment" ADD COLUMN "calendly_event_type_uri" TEXT;
ALTER TABLE "appointment" ADD COLUMN "meeting_url" TEXT;
ALTER TABLE "appointment" ADD COLUMN "scheduled_at" TIMESTAMP(3);
ALTER TABLE "appointment" ADD COLUMN "cancelled_at" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "appointment_calendly_invitee_uri_key" ON "appointment"("calendly_invitee_uri");
