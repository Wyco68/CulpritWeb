---
status: current
source_of_truth: true
last_updated: 2026-10-11
related_modules: [profile, research-groups, shared]
related_decisions: [ADR-016, ADR-020]
---

# ADR-025: The About tab is removed; the director's card moves to the Team tab

## Status

Accepted. Amends [ADR-016](ADR-016-lab-team-profiles.md), which made About the lab overview plus
a director card.

## Date

2026-10-11

## Context

Feedback from the last project presentation: About repeated what the Team tab already shows. Its
only content was the lab overview and the director's card. The Team tab already listed the
director first, but on a card that linked only to the profile page, so reaching the director's
Scholar or ORCID page took an extra click.

## Decision

- The public About tab is gone. `/` redirects (307, in `next.config.ts`) to `/research`, the first
  remaining tab. The redirect is temporary so browsers do not pin `/` if a home page ever returns.
  The header's lab name, the 404 page and sign-out link to `/research` directly.
- The Team tab's director card is now the shared `MemberCard`, the same card that heads every
  profile page. It shows the photo, the "Lab Director · role" line, the name, the affiliation, a
  Profile pill, and the director's `member_link` rows as pills that open in a new tab.
- The admin About screen is now **Identity** (`/admin/identity`). It edits only the lab name,
  tagline and affiliation shown in the site header. `/admin/about` and `/admin/profile` redirect
  there.
- The `lab_overview` column stays in the schema and API, but it has no admin field and no public
  page. Keeping the column avoids a destructive migration on the shared database, and the text is
  still there if it is ever wanted again.

## Consequences

- One fewer prerendered page. The `about` revalidation area is removed, and `team` no longer
  purges `/`.
- The Team page makes one extra query, `listLinks(director)`, when it renders. It is still
  prerendered, so visitors don't pay for it.
