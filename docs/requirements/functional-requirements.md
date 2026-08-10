---
status: current
source_of_truth: false
last_updated: 2026-08-08
related_modules: [profile, research, publications, research-groups, appointments, settings, auth]
related_decisions: [ADR-004, ADR-005]
---

# Functional requirements

> **Source of truth:** [PROJECT_SPEC.md §5](../../PROJECT_SPEC.md#5-functional-requirements). This
> page is a distilled, current-only view for quick agent lookup — it drops the strikethrough/removed
> rows the spec keeps for history. Read the spec section for the full removal history and dates.

## Public content (visitor)

| ID | Requirement |
|----|-------------|
| FR-1 | Visitor can view the **Bio** tab: professor photo, name, title, background text. |
| FR-2 | Visitor can view the **Research** tab: a simple list of research works (title + summary + area). |
| FR-3 | Visitor can view **Publications**: title, authors, venue, year, and an external link. `link` is nullable — shown only when present. |
| FR-4 | Visitor can view **Team Members**, grouped by research group (CV-style: works & achievements). Backed by the relational `TeamMember` entity, not a "Research Groups" tab. |
| FR-5 | Visitor can view the **Upcoming Events** tab **only if** the admin has enabled its visibility. |
| FR-6 | The site is fully readable without any login. |

## Appointments (visitor)

There is **no visitor-facing appointment request form** — see [ADR-004](../decisions/ADR-004-appointment-workflow-admin-only.md). Only one visitor-facing appointment behavior exists:

| ID | Requirement |
|----|-------------|
| FR-7a | Visitor can **book directly** against the professor's live availability via the **embedded Calendly** widget, without admin approval. The booking happens entirely on Calendly's side (incl. Calendly's own confirmation email) — nothing about it reaches this app. See [ADR-005](../decisions/ADR-005-calendly-embed-only.md). |
| FR-10 | The **Make Appointment** tab shows the embedded Calendly widget for live availability + direct booking. This is the entire tab — no request form is rendered. Gated by a Turnstile challenge before the embed reveals (see [architecture/backend.md](../architecture/backend.md)). |

## Admin — content management

| ID | Requirement |
|----|-------------|
| FR-13 | Admin can log in via a single admin account. |
| FR-14 | Admin can edit the structured **Bio** (position/affiliation, education, fellowships & visiting appointments, teaching roles, teaching awards, scholarships & travel awards, research interests, research statement, invited talks, LinkedIn/Google Scholar links), Research, Publications, Research Groups, and Team Members via simple forms. |
| FR-15 | Each editing form has a clear **"Save changes"** action with success/error feedback. |
| FR-16 | Admin can toggle whether **Upcoming Events** is visible to visitors. |

## Admin — appointment management

There is **no review queue** — see [ADR-004](../decisions/ADR-004-appointment-workflow-admin-only.md). An appointment exists only because the admin declared it directly.

| ID | Requirement |
|----|-------------|
| FR-17 | Admin sees a table/list of appointments: name, research group, scheduled time, status. |
| FR-17a | Admin can **add** an appointment directly: requester name (required), email (optional, informational only), research group (optional), scheduled time, topic (optional). Lands as `scheduled` immediately — no approval step. |
| FR-17b | Admin can **edit** a `scheduled` appointment's details. `409` if it has already been cancelled. |
| FR-21 | Admin can **cancel** a `scheduled` appointment (status → `cancelled`, reason required, record retained). |
| FR-22 | No appointment record is ever hard-deleted; cancelled items remain for audit. |

## Historical (removed 2026-08-08) — do not implement

These requirement IDs existed in an earlier design and are **not current**. Kept here only so an
agent recognizes them as deliberately removed, not as a gap to fill:

- ~~FR-7~~ — visitor-submitted appointment request form.
- ~~FR-8~~/~~FR-9~~ — `pending`/`booked` status distinction shown to the visitor.
- ~~FR-11~~ — visitor self-cancel via a unique link/token.
- ~~FR-12~~ (original form) — bot-guarding a request form (repurposed: Turnstile now guards the
  Calendly embed's visibility instead, see FR-10).
- ~~FR-16a~~ — admin-configurable default appointment slot duration.
- ~~FR-18~~/~~FR-19~~/~~FR-20~~ — approve / decline / mark-booked admin actions.
- ~~FR-23~~ — appointment status-change notification emails.

Full rationale: [PROJECT_SPEC.md §5.2/§5.4](../../PROJECT_SPEC.md#52-appointment-request-visitor).
