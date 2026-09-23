-- Swap `event_participant`'s indexes to match how the table is actually queried.
--
-- Drop `event_participant_event_id_idx`: redundant. `@@unique([eventId, teamMemberId])` already
-- created a composite index whose leftmost column is `eventId`, so a plain `eventId` lookup (the
-- only kind this table gets) is already served by leftmost-prefix matching. One less index to
-- maintain on every participant write.
--
-- Add `event_participant_team_member_id_idx`: `team_member.teamMember` relation is
-- `onDelete: SetNull`, so deleting a team member nulls every `event_participant.team_member_id`
-- that points at them. Without an index on that column, Postgres has to scan the whole table to
-- find the rows to null out.

-- DropIndex
DROP INDEX "event_participant_event_id_idx";

-- CreateIndex
CREATE INDEX "event_participant_team_member_id_idx" ON "event_participant"("team_member_id");
