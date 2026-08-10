---
status: current
source_of_truth: false
last_updated: 2026-08-08
related_modules: [shared, appointments]
related_decisions: []
---

# Testing

## Tools

| Layer | Tool | Config |
|---|---|---|
| Unit + component | Vitest + Testing Library, jsdom | `vitest.config.ts` — includes `src/**/*.{test,spec}.{ts,tsx}` |
| E2E | Playwright | `tests/e2e/*.spec.ts` |

## Commands

```bash
npm test          # vitest run
npm run test:watch
npm run test:e2e   # playwright test
npm run typecheck  # tsc --noEmit
npm run lint       # next lint
```

## What's actually covered (verified in `src/**/__tests__/`)

- **Service/schema unit tests**: `appointment.schema.test.ts`, `appointment.serializer.test.ts`,
  `appointment.service.test.ts`, `upcoming-events.service.test.ts`; equivalents for `profile`,
  `research`, `publications`, `research-groups`/`team-member`, `settings`; `storage-adapter.test.ts`
  + `storage-adapter.factory.test.ts`; `youtube-utils.test.ts`.
- **Component tests**: `appointments-table.test.tsx`, `youtube-video.test.tsx`, admin
  `layout.test.tsx` (guard redirect behavior).
- **API/route tests**: `research.route.test.ts` (`src/app/api/admin/research/__tests__/`),
  `upcoming.route.test.ts` (`src/app/api/events/upcoming/__tests__/`).
- **E2E**: `tests/e2e/appointment.spec.ts`, `tests/e2e/login.spec.ts`.

Only the `appointments` module has API-route-level tests today (research CRUD, upcoming events).
Other admin CRUD routes (`profile`, `publications`, `groups`, `team-members`, `settings`) do not
yet have route-level tests — service/schema unit coverage exists for them, but not the boundary.

## Conventions carried over from the design guide (still valid)

- **Services are the test priority** — inject a mocked repository/integrations, no real DB or
  network needed; framework-agnostic by design.
- **Test both directions of every legal/illegal state transition** for the appointment machine:
  `scheduled → cancelled` succeeds and writes an audit entry; cancelling an already-cancelled
  appointment returns `ConflictError` with no side effects.
- Query by role/label/text in component tests (never test-id for user-facing assertions);
  `@testing-library/user-event` for interactions.
- Keep tests deterministic — no real time/network/random; inject clocks/ids where behavior depends
  on them.

## What no longer applies

`.claude/skills/fullstack-nextjs-starter/references/testing.md` describes testing the old
five-state appointment machine (`approve`/`decline`/`book`), visitor self-cancel via token, and
notification-email side effects on every transition — **none of that exists anymore**. Don't write
tests against those behaviors; see
[ADR-004](../decisions/ADR-004-appointment-workflow-admin-only.md).
