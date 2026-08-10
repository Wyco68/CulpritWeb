---
status: current
source_of_truth: false
last_updated: 2026-08-08
related_modules: [shared, integrations, auth]
related_decisions: []
---

# Non-functional requirements

> **Source of truth:** [PROJECT_SPEC.md §6](../../PROJECT_SPEC.md#6-non-functional-requirements).

| Category | Requirement |
|----------|-------------|
| Performance | Public pages load in < 2s on broadband; content served from cache/CDN where possible. |
| Security | HTTPS everywhere; server-side input validation on every form (Zod at the boundary); admin session hardening (secure, httpOnly cookies via Better Auth); secrets kept out of the client; least-privilege API. |
| Spam / abuse | No public appointment-*writing* endpoint exists to spam. Turnstile + Upstash rate-limiting gate *visibility* of the public Calendly embed (`POST /api/turnstile/verify`, IP-rate-limited) — see [architecture/backend.md](../architecture/backend.md). |
| Privacy | Minimal PII collected (visitor name + email only, and only when an admin types it in). No PII in URLs/query strings. Cancelled appointment records retained for audit, never hard-deleted. |
| Accessibility | WCAG 2.1 AA: semantic HTML, keyboard navigation, sufficient contrast, alt text on the professor photo. |
| Responsive | Mobile-first; usable from 320px up to desktop. |
| Availability | Target 99.5% uptime for the public site. |
| Maintainability | Modular, feature-first, layered architecture; clear layer boundaries; documented API; typed data model. |
| Observability | `AuditLog` table records admin mutations and appointment status transitions, written transactionally in the repository layer alongside the mutation. Backend-only by design — no admin UI viewer exists or is planned (confirmed 2026-08-08). |
| Compatibility | Latest 2 versions of major browsers (Chrome, Firefox, Safari, Edge). |
| Cost | **Free-tier-only, deliberately** — every third-party service (Calendly embed, Turnstile, Upstash Redis, Resend, Supabase Postgres, Cloudflare R2) must stay usable on its free tier. |
| Localization | **None.** English-only, no i18n library. See [ADR-006](../decisions/ADR-006-remove-i18n-and-locale-routing.md). |
