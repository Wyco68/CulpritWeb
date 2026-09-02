---
status: current
source_of_truth: false
last_updated: 2026-08-08
related_modules: [events, teaching, integrations]
related_decisions: [ADR-004, ADR-005, ADR-006]
---

# Scope

> **Source of truth:** [PROJECT_SPEC.md §2](../../PROJECT_SPEC.md#2-goals--non-goals) and
> [§3](../../PROJECT_SPEC.md#3-scope).

## In scope (current)

- Public site: **About**, **Research**, **Publications**, **Teaching**, **Team Members**,
  **Events**, **Make Appointment** — 7 tabs, flat routes under `src/app/(public)/`.
- Teaching: courses grouped by level, plus teaching roles and awards. CV content is `cv_entry`
  rows, not Json on the profile — see
  [ADR-012](../decisions/ADR-012-cv-entries-and-courses.md).
- Research groups & visiting-professor listing (CV-style) via **Team Members**.
- Direct booking via embedded Calendly widget — Calendly's own flow, not recorded in this app.
- Admin **authors events** (title, date, description, photo uploads, YouTube embeds). Upcoming vs
  past is derived from the date; every event is public.
- Admin panel: Profile / Research / Publications / Groups / Team Members / **Events**.
- Single admin authentication (Better Auth).
- No appointment feature of any kind on the admin side, and no notification emails in either
  direction. See [ADR-011](../decisions/ADR-011-events-replace-appointments.md).

## Explicitly out of scope

These are **deliberate, standing exclusions** — do not reintroduce them without a new ADR and an
explicit decision:

- **NG1/NG2 — no server-side Calendly integration.** No PAT, no REST client, no webhook receiver.
  Calendly has no public booking-creation API on any plan, and webhook subscriptions require a paid
  tier this project stays off of. See [ADR-005](../decisions/ADR-005-calendly-embed-only.md).
- **NG3 — no public user accounts, logins, or profiles for visitors.**
- **NG4 — no multi-admin, no per-researcher self-editing.** Single admin only.
- **NG5 — no payments, no messaging/chat, no content approval or draft/publish workflow.**
- **NG6 — no appointment feature at all.** No request/review/approval queue, no admin appointment
  screen, no `Appointment` table, and no server-side link between a Calendly embed booking and
  anything stored here. A booking worth publishing is written up by hand as an event. See
  [ADR-011](../decisions/ADR-011-events-replace-appointments.md), and
  [ADR-004](../decisions/ADR-004-appointment-workflow-admin-only.md) for the history.
- **No video files.** Event video is a YouTube embed; nothing uploads or proxies video, which keeps
  the project inside R2's free tier.
- **No i18n / multi-language support**, ever. See
  [ADR-006](../decisions/ADR-006-remove-i18n-and-locale-routing.md).
- **No light/dark theme switching.** One fixed visual treatment (explicit client instruction).
- Public search, tagging, or filtering of publications.
- Analytics dashboard, native mobile apps.
- Scheduling emails of any kind (the `notifications` module was deleted; `EmailClient`/Resend infra
  remains, reserved for other future admin-facing features).

## Open questions (unresolved — check before assuming an answer)

From [PROJECT_SPEC.md §14.3](../../PROJECT_SPEC.md#143-open-questions):

- Delegated assistant admin — needed at launch, or later?
- Which admin-facing feature (if any) should be the first Resend/`EmailClient` caller?
- Do publications need BibTeX/ORCID import, or manual entry only?
- Should a visitor-facing request/review queue ever be reintroduced?
- Supabase's free tier has no automatic backups — accept the risk, script one, or budget for a paid
  tier? Not yet decided.
- Buy a custom domain, or keep the free `culprit.wyco-dev.com` subdomain? Not yet decided
  (independent of the R2 public-URL decision, which is already resolved — see
  [ADR-002](../decisions/ADR-002-object-storage-r2.md)).
