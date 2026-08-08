-- AlterEnum
BEGIN;
CREATE TYPE "AppointmentStatus_new" AS ENUM ('scheduled', 'cancelled');
ALTER TABLE "public"."appointment" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "appointment" ALTER COLUMN "status" TYPE "AppointmentStatus_new" USING ("status"::text::"AppointmentStatus_new");
ALTER TYPE "AppointmentStatus" RENAME TO "AppointmentStatus_old";
ALTER TYPE "AppointmentStatus_new" RENAME TO "AppointmentStatus";
DROP TYPE "public"."AppointmentStatus_old";
ALTER TABLE "appointment" ALTER COLUMN "status" SET DEFAULT 'scheduled';
COMMIT;

-- DropIndex
DROP INDEX "appointment_calendly_invitee_uri_key";

-- DropIndex
DROP INDEX "appointment_cancel_token_key";

-- DropIndex
DROP INDEX "appointment_created_at_idx";

-- AlterTable
ALTER TABLE "appointment" DROP COLUMN "calendly_event_ref",
DROP COLUMN "calendly_event_type_uri",
DROP COLUMN "calendly_event_uri",
DROP COLUMN "calendly_invitee_uri",
DROP COLUMN "cancel_token",
DROP COLUMN "cancelled_at",
DROP COLUMN "meeting_url",
DROP COLUMN "requested_time",
DROP COLUMN "requester_email",
DROP COLUMN "source",
ALTER COLUMN "status" SET DEFAULT 'scheduled',
ALTER COLUMN "scheduled_at" SET NOT NULL;

-- DropEnum
DROP TYPE "AppointmentSource";

-- CreateIndex
CREATE INDEX "appointment_scheduled_at_idx" ON "appointment"("scheduled_at");

