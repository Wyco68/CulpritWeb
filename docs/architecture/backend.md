---
status: current
source_of_truth: false
last_updated: 2026-08-08
related_modules: [appointments, auth, integrations, shared]
related_decisions: [ADR-004, ADR-005]
---

# Backend architecture

## API routes

REST/JSON under `src/app/api/`. `Auth`: **Public** = no auth, **Admin** = admin session required
(checked in the handler via `requireAdmin()`, not just middleware — there is no `middleware.ts`).

### Public content reads

| Method | Path |
|---|---|
| GET | `/api/profile`, `/api/research`, `/api/publications`, `/api/groups`, `/api/team-members` (optional `?groupId=`) |
| GET | `/api/events/upcoming` (empty/403 if visibility off) |

### Appointments — admin only, entire surface

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/admin/appointments` | List, optional `?status=` filter |
| POST | `/api/admin/appointments` | Declare directly → `scheduled` |
| PUT | `/api/admin/appointments/{id}` | Edit a `scheduled` appointment; `409` if cancelled |
| POST | `/api/admin/appointments/{id}/cancel` | `scheduled → cancelled` + required reason; `409` if already cancelled |

**No public appointment-writing endpoint exists** (`POST /api/appointments` was removed
outright) and **no Calendly integration route exists** (no `/api/integrations/calendly/*`) — see
[ADR-004](../decisions/ADR-004-appointment-workflow-admin-only.md) and
[ADR-005](../decisions/ADR-005-calendly-embed-only.md).

### Admin content & auth

| Method | Path |
|---|---|
| POST/GET | `/api/auth/[...all]` — Better Auth's own handler (login/logout/session) |
| PUT | `/api/admin/profile`, POST `/api/admin/profile/photo` |
| CRUD | `/api/admin/research[/{id}]`, `/api/admin/publications[/{id}]`, `/api/admin/groups[/{id}]`, `/api/admin/team-members[/{id}]` |
| PUT | `/api/admin/settings` |

### Bot-defense edge

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/turnstile/verify` | Confirms a Turnstile token before the client reveals the public Calendly embed. IP-rate-limited via Upstash. Not a form-submission endpoint — nothing is written. |

## Route handler contract

Every handler follows the same shape (see `src/app/api/admin/appointments/[id]/cancel/route.ts`
or `src/app/api/turnstile/verify/route.ts` for concrete examples):

1. `await` params/searchParams; authenticate admin routes via `requireAdmin()`.
2. Parse body/query with the module's Zod schema → structured `400` via `apiValidationError()` on failure.
3. Rate-limit + Turnstile-verify where the route is public and mutating (currently only
   `/api/turnstile/verify` itself — `guardPublicWrite()` in `integrations/guard/` is written but
   has no current caller, kept ready for a future public write endpoint).
4. Call exactly one service method.
5. Map the service's `Result` → JSON via `respond()`/`apiSuccess()`/`apiError()`
   (`src/modules/shared/lib/api-response.ts`) — success payload, or typed error → HTTP status.

## Error handling

`src/modules/shared/lib/errors.ts` defines `AppError` subclasses, each with a fixed HTTP status:

| Error | Status |
|---|---|
| `ValidationError` | 400 |
| `UnauthorizedError` | 401 |
| `ForbiddenError` | 403 |
| `NotFoundError` | 404 |
| `ConflictError` | 409 |
| `RateLimitError` | 429 (sets `Retry-After`) |
| `IntegrationError` | 502 |
| `InternalError` | 500 |

Services return `Result<T, AppError>` (never throw for expected failures); the boundary maps it to
the standardized envelope `{ ok: true, data }` / `{ ok: false, error: { code, message, fieldErrors? } }`.
5xx errors are logged server-side with cause detail; only the safe code/message reach the client.

## Service / domain layer

One service per module (`src/modules/<name>/<name>.service.ts`), constructed via a small
composition-root `container.ts` per module (e.g. `getAppointmentService()` in
`appointments/container.ts`) — no DI framework, just a cached factory function.

The **appointment state machine** (`appointment.service.ts`) is the most important piece:
`scheduled → cancelled` is the only transition, enforced by checking `current.status` before
calling the repository; any other attempt returns `ConflictError` → `409`. There is no
`TRANSITIONS` allow-map data structure (the two-state machine doesn't need one) — that's a
simplification versus the originally-designed five-state machine, not a missing feature.

## Validation

Zod schemas are the single source of truth per module (`<module>.schema.ts`), used for both the
client form resolver and the server boundary parse. See
[development/coding-conventions.md](../development/coding-conventions.md).

## Audit logging

Written by the **repository**, not the service — see
[architecture/overview.md](overview.md#layers) for why this deviates from the original design
doc. Every repository that mutates state writes an `AuditLog` row in the same Prisma
`$transaction` as the domain mutation.
