-- Undo the team-derived hidden sections (2026-09-27, ADR-020).
--
-- 20260927140000_custom_teams_and_profile_sections backfilled each member's `hidden_sections` from
-- their old fixed team. That ties what a profile shows to the team, which ADR-020 rules out: the
-- team is a heading and nothing more, and every section is the admin's choice per member.
--
-- Only rows still holding EXACTLY the backfilled value are cleared, so any section the admin has
-- switched by hand since is left as they set it. A section with no content never shows, so
-- clearing these changes nothing visible until the admin fills one in.

UPDATE "team_member"
SET "hidden_sections" = ARRAY[]::"ProfileSection"[]
WHERE "team_kind" = 'research'
  AND "hidden_sections" = ARRAY['education', 'fellowship', 'scholarship', 'invited_talk', 'teaching_role', 'teaching_award', 'courses']::"ProfileSection"[];

UPDATE "team_member"
SET "hidden_sections" = ARRAY[]::"ProfileSection"[]
WHERE "team_kind" = 'development'
  AND "hidden_sections" = ARRAY['research_interest', 'education', 'fellowship', 'scholarship', 'invited_talk', 'teaching_role', 'teaching_award', 'courses', 'research', 'publications']::"ProfileSection"[];
