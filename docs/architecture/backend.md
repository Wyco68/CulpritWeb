---
status: current
source_of_truth: false
last_updated: 2026-08-10
related_modules: [appointments, auth, integrations, shared]
related_decisions: [ADR-004, ADR-005, ADR-007, ADR-008]
---

# Backend architecture

## API routes

REST/JSON under `src/app/api/`. `Auth`: **Public** = no auth, **Admin** = admin session required
(checked in the handler via `requireAdmin()` — `src/middleware.ts` exists, ADR-008, but only as a
rate-limit fallback on `/api/auth/*` and mutating `/api/admin/*`; it never decides authorization).

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
| POST | `/api/turnstile/verify` | Confirms a Turnstile token before the client reveals the public Calendly embed. IP-rate-limited via the in-process fallback limiter (see [ADR-008](../decisions/ADR-008-cloudflare-rate-limiting.md)). Not a form-submission endpoint — nothing is written. |

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

## Caching

Two layers, both native Next.js — no Redis app-cache, no CDN, no cache-tag system (see
[ADR-007](../decisions/ADR-007-fix-cache-invalidation-and-cache-public-api-routes.md)).

- **Full Route Cache for public pages.** Every `(public)` page is a prerendered Server Component
  served from Next's Full Route Cache (`x-nextjs-cache: HIT`, ~5ms).
- **ISR-style caching on five of the six public GET API routes** (`/api/profile`,
  `/api/research`, `/api/publications`, `/api/groups`, `/api/events/upcoming`) via
  `export const revalidate` on each route module — the same on-demand cache Next already manages
  for pages, not a separate mechanism. `/api/events/upcoming` uses 300s (time-sensitive: a
  scheduled appointment can pass into the past between invalidations); the rest use 3600s.
  **`/api/team-members` is the exception and stays uncached** — it reads
  `request.nextUrl.searchParams` for its optional `?groupId=` filter, which `next build` confirms
  forces the route dynamic (`ƒ /api/team-members`, not `○ Static`); every request hits the DB. See
  [ADR-007](../decisions/ADR-007-fix-cache-invalidation-and-cache-public-api-routes.md#correction-2026-08-10-same-day-apiteam-members-does-not-cache).
- **On-demand invalidation via `revalidatePath`**, triggered only from admin mutation route
  handlers (`revalidateOn()` / `revalidatePublic()` in
  `src/modules/shared/lib/revalidate.ts`) — those handlers are already `requireAdmin()`-gated, so
  this satisfies "admin-only invalidation" by construction; there is no separate purge endpoint.
  Each `PublicArea` maps to both its public page path and its mirrored public API route(s), so one
  admin write purges both.
- **3600s/300s `export const revalidate` values are ceilings, not the primary freshness path** —
  they only bound how long a change made *outside* the app (direct DB edit, re-seed, restored
  backup) could sit invisible behind the cache. Same rationale as the public layout's existing
  `export const revalidate = 3600` safety net.
