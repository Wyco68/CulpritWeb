-- DropIndex
DROP INDEX "appointment_calendly_invitee_uri_key";

-- AlterTable
ALTER TABLE "appointment" DROP COLUMN "calendly_event_ref",
DROP COLUMN "calendly_invitee_uri",
DROP COLUMN "source";

-- DropEnum
DROP TYPE "AppointmentSource";

