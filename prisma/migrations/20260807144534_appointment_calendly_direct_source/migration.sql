-- CreateEnum
CREATE TYPE "AppointmentSource" AS ENUM ('admin', 'direct');

-- AlterTable
ALTER TABLE "appointment" ADD COLUMN     "calendly_event_ref" TEXT,
ADD COLUMN     "calendly_invitee_uri" TEXT,
ADD COLUMN     "requester_email" TEXT,
ADD COLUMN     "source" "AppointmentSource" NOT NULL DEFAULT 'admin';

-- CreateIndex
CREATE UNIQUE INDEX "appointment_calendly_invitee_uri_key" ON "appointment"("calendly_invitee_uri");

