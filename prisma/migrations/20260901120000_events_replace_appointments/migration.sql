-- Events replace Appointments.
--
-- An event is plain published content (title, date, description, photos, videos) with no status,
-- no lifecycle and no per-row visibility flag — `event_date` alone decides Upcoming vs Past at
-- render time. Media are native text arrays rather than JSONB: flat lists of URLs with no internal
-- structure.

-- CreateTable
CREATE TABLE "event" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "event_date" TIMESTAMP(3) NOT NULL,
    "photo_urls" TEXT[],
    "video_urls" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "event_event_date_idx" ON "event"("event_date");

-- DropTable — appointments are removed outright, not archived or migrated into `event`. Every
-- appointment row was admin-declared scheduling data with no public surface left once /events
-- became Event-backed, and the customer asked for the data to go with the feature. This is
-- IRREVERSIBLE: there is no export step. The AuditLog rows for those appointments are left in
-- place deliberately, as the only remaining record that they existed.
DROP TABLE "appointment";

-- DropEnum
DROP TYPE "AppointmentStatus";
