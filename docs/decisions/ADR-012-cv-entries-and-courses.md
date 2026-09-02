---
status: current
source_of_truth: true
last_updated: 2026-09-02
related_modules: [teaching, profile]
related_decisions: [ADR-011]
---

# ADR-012: CV entries and courses become tables; Teaching gets its own tab

## Status

Accepted

## Date

2026-09-02

## Context

`Profile` carried seven `Json` columns — `education`, `fellowships_visiting`, `teaching_roles`,
`teaching_awards`, `scholarships_travel_awards`, `research_interests`, `invited_talks` — each an
array of `{title, subtitle?, year?, description?}`. All seven rendered on the About tab through
`ProfileAffiliations`, and all seven were written by a single whole-document `PUT /api/admin/profile`.

Two things forced the change.

**The customer asked for a Teaching tab.** Teaching roles and awards belong on it, and courses —
which the site could not represent at all — belong on it too. But `teaching_roles` and
`teaching_awards` could only be written as part of a profile document that also carried the five
About lists. Splitting them across two pages was not possible without either two forms racing to
write the same row, or a partial-update hack that reads the whole profile just to change one list.

**The columns were a 1NF violation.** A repeating group in a single field: not queryable, not
indexable, no per-entry identity, no per-entry audit trail, and no way to edit one line without
rewriting all of them.

## Decision

**1. Seven `Json` columns become one `cv_entry` table** with a `section` enum
(`education`, `fellowship`, `scholarship`, `research_interest`, `invited_talk`, `teaching_role`,
`teaching_award`).

One table with a discriminator, not seven tables. All seven sections carry an identical attribute
set — title, subtitle, year, description — so this is one entity with a category, not seven
entities. Seven tables would have meant seven repositories, seven service pairs, fourteen route
handlers and seven test files to say the same thing. `section` is editable, so an entry can be
moved between lists without being retyped.

**2. A new `course` table** backs the Teaching tab: `code?`, `title`, `level`, `term?`,
`description?`, `link?`, `sortOrder`. A course is a genuinely different entity from a CV entry — it
carries a code, a level and a term that no CV line has — so it is not a `cv_entry` section.

`level` is free text, not an enum, matching the `Research.area` precedent: level naming differs by
institution and the admin should not need a migration to add one. It is the grouping key on the
public tab, and the first course of a level fixes where that level sits — the same ordering rule
the Research index already uses.

**3. `year` is free text, not an integer.** Entries are routinely a range (`2019–2023`) or
`present`.

**4. Ordering is per-section.** `sortOrder` is only meaningful within one `section`, so every query
orders by `section` first.

**5. The Teaching tab** (`/teaching`) shows courses grouped by level, then teaching roles and
awards. About (`/`) keeps the other five sections and loses the two teaching ones.

**6. `ProfileForm` loses its list editors.** The profile form is now what its name says: the
singleton identity and prose. CV entries are managed on `/admin/teaching`, one row at a time.

## Alternatives considered

- **Seven separate tables** — rejected as roughly seven times the code for no gain in normal form.
  An earlier round of this work started down that path and was abandoned.
- **Keep the `Json` columns, add a `Course` table only** — rejected: it leaves teaching roles and
  awards unreachable from the Teaching tab without a partial-profile write, which is the problem
  that started this.
- **Split into `about_entry` and `teaching_entry` tables** — rejected: `section` is editable
  precisely so the admin can reclassify an entry, and a table boundary would turn that into a
  delete-and-retype.

## Consequences

- **Destructive migration.** `20260902100000_cv_entries_and_courses` copies the JSONB into
  `cv_entry` (array position becomes `sortOrder`, blank-titled entries skipped) and then drops all
  seven columns. There is no down path; the backfill is the only thing between the old content and
  losing it. Verified on the dev database: 19 rows across all seven sections.
- `Profile`, `ProfileListItem`, `updateProfileSchema` and `profile.repository` all shrink to the
  scalar fields. `ProfileListItem` is gone entirely.
- `src/modules/profile/ui/{profile-affiliations,list-field-editor}.tsx` are deleted. Their public
  rendering is now `teaching/ui/cv-entry-list.tsx`, kept visually identical on purpose.
- New public area in `revalidate.ts`: `teaching`. Also a new `about` area (`['/']`) — a CV entry
  edit changes the body of `/` only, so purging the whole layout subtree the way `'profile'` does
  would be indiscriminate. CV-entry writes purge both, because `section` is editable and an edit
  can move an entry between the two tabs.
- The public tab bar goes from six tabs to seven; `sitemap.ts` and `robots.ts` follow.
- The dashboard's profile-completeness meter now counts four profile fields plus one-entry-present
  per About section, rather than eleven `Json` columns.
- **Ordering is still a number field**, not drag-and-drop. That was agreed as the target UX but is
  cross-cutting (it touches `cv_entry`, `course`, `research`, `team_member` and every future
  junction) and needs `@dnd-kit` plus a keyboard path for WCAG 2.1 AA. Tracked separately.

## Supersedes / Superseded by

Does not supersede any prior ADR. It is the first step of the data-model plan that
[ADR-011](ADR-011-events-replace-appointments.md) left off at; the relationship tables for events,
research groups and guests in that plan are still outstanding.
