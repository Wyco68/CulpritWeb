-- Date-only events (2026-09-28).
--
-- Most events are remembered by their day, not their time. `show_time` says whether the time of
-- day in `event_date` is known and shown. It defaults to false, so every existing event becomes
-- date-only: the pages show the day alone, and the event stays upcoming for the whole of that day.
-- Additive — code that doesn't know the column keeps working, and every new row gets the default.

ALTER TABLE "event" ADD COLUMN "show_time" BOOLEAN NOT NULL DEFAULT false;
