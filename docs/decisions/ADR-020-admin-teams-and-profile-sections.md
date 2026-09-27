---
status: current
source_of_truth: true
last_updated: 2026-09-27
related_modules: [research-groups, teaching, shared]
related_decisions: [ADR-016, ADR-017]
---

# ADR-020: Teams are admin-defined; each member's profile sections are switched on and off per member

## Status

Accepted. Supersedes ADR-017's fixed `TeamKind` enum and its per-team rules table. ADR-017's
`member_link` and `project` tables are unaffected.

## Date

2026-09-27

## Context

ADR-017 fixed the lab to four teams — director, professor, research, development — and hard-coded
what each team's profile pages could show. In practice the lab names its own groups, and what a
page should show depends on the person, not on the group: a developer who co-authored a paper
should be able to show it, and a researcher who teaches should be able to list courses.

## Decision

1. **A `team` table the admin manages** — a name (unique, case-insensitively) and a position. A
   member points at one team or none (`team_member.team_id`, `ON DELETE SET NULL`: deleting a team
   leaves its members listed without one). Admin routes: `POST /api/admin/teams`,
   `PUT|DELETE /api/admin/teams/[id]`.
2. **Nothing is derived from the team.** It is a heading on the Team tab and nothing more.
3. **Per-member section switches.** `team_member.hidden_sections` lists the profile sections
   switched off for that member (`ProfileSection` enum: the seven CV sections plus publications,
   research, projects and courses). The service filters CV entries, courses and projects on read;
   the profile page skips byline resolution for hidden research/publications. Hiding never deletes
   anything, and every list stays editable in the admin, marked "Hidden". Any member may hold any
   kind of entry — the teaching service no longer rejects writes by team.
4. **One director, fixed.** `isDirector` is no longer an admin input: the member schemas do not
   accept it, and no write touches it. The partial unique index `team_member_one_director` stays as
   the database-level guarantee. The director is featured across the full width at the top of the
   Team tab, on no team, with the same square portrait as everyone else.
5. **Profile sections in order of importance**, the order of `PROFILE_SECTIONS`: biography,
   research interests, publications, research, projects, education, invited talks, fellowships,
   scholarships, courses, teaching roles, teaching awards. The page and its jump list are built
   from that one list.

## Schema

`20260927140000_custom_teams_and_profile_sections`, additive because the database is shared with
the deployed app: the `team` table, `team_member.team_id` and `hidden_sections`, and
`team_member.team_kind` made nullable. Existing professor/research/development members are moved
onto matching team rows; nobody's hidden sections are backfilled — a section with no content never
shows, so this changes nothing visible until the admin fills one in.

**Follow-up:** drop `team_member.team_kind` and the `TeamKind` type once this deploy is live. Until
then the deployed build still reads the column, so a member created by the new build (which leaves
it null) would break the old build's Team tab — deploy promptly after the migration runs.

## Also fixed

The global `img, video { height: auto }` backstop in `globals.css` was unlayered, and unlayered CSS
beats every Tailwind utility. It overrode `size-16` on avatars, so a portrait photo (the
director's) rendered taller than its square frame. It now sits in `@layer base`.
