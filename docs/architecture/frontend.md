---
status: current
source_of_truth: false
last_updated: 2026-08-08
related_modules: [shared, profile, research, publications, research-groups, appointments, settings, auth]
related_decisions: [ADR-006]
---

# Frontend architecture

## Framework & routing

- Next.js 15 App Router, React 19, TypeScript, Tailwind v4.
- **Flat routes, no `[locale]` segment.** `src/app/(public)/` and `src/app/(admin)/admin/` are
  route groups (no URL segment) sharing the root layout. See
  [ADR-006](../decisions/ADR-006-remove-i18n-and-locale-routing.md).
- Public pages are Server Components that read through services directly (no client JS for the
  read path, best SEO/a11y).
- Admin pages are also Server Components for the initial load; interactive pieces (tables, forms,
  dialogs) are client components (`'use client'`) using TanStack Query for data.

## Component structure

- shadcn/ui, **`new-york`** style, components copied into `src/modules/shared/ui/` and owned by
  the repo (`avatar`, `button`, `card`, `confirm-dialog`, `dialog`, `empty-state`, `form-field`,
  `input`, `label`, `select`, `switch`, `table`, `textarea`, `page-skeleton`).
- Icons: `lucide-react`, imported per-icon.
- Toasts: `sonner` (`<Toaster/>` rendered once in `src/app/providers.tsx`).
- Module-specific composite components (`appointment-form-dialog.tsx`, `appointments-table.tsx`,
  etc.) live under each module's `ui/` folder, built from the shared primitives.
- Design tokens (navy/accent CSS variables) live in `src/app/globals.css` — Tailwind v4's
  CSS-first `@theme`, not a `tailwind.config.js`.

## Provider tree

`src/app/providers.tsx` (client) composes, in order:

```
<QueryClientProvider client={queryClient}>
  {children}
  <Toaster richColors closeButton />
</QueryClientProvider>
```

Deliberately **no** i18n provider (removed) and **no** theme provider (one fixed visual look —
navy chrome + light content — matching the Figma prototype; light/dark switching is explicitly
out of scope). `getQueryClient()` (`src/modules/shared/lib/query-client.ts`) returns a fresh
client on the server and a cached singleton in the browser.

## State / data fetching

- **Server Components** are the default read path for public content — no client-side fetch
  needed, no loading spinner.
- **TanStack Query v5** is used in admin UI for client interactivity: tables with filters, form
  dialogs, mutations with cache invalidation (`profile-form`, `*-table`, `*-form-dialog`
  components across `research`, `publications`, `research-groups`, `appointments`, `settings`).
- **React Hook Form + Zod** (`@hookform/resolvers/zod`) drives every admin form; the same Zod
  schema validates client-side (UX) and server-side (source of truth) — see
  [development/coding-conventions.md](../development/coding-conventions.md).

## Public tabs (6)

Routed as real pages under `src/app/(public)/`: About (`/`), Research (`/research`), Publications
(`/publications`), Team Members (`/team`), Upcoming Events (`/events`, admin-gated), Make
Appointment (`/appointment`, Turnstile-gated Calendly embed only).

## Admin pages

`src/app/(admin)/admin/`: Dashboard (`/admin`), Profile, Research, Publications, Research Groups
(`groups`), Team Members, Appointments, Settings, plus `(admin)/login`. **No Audit-log viewer
page exists, and none is planned** (confirmed 2026-08-08) — `AuditLog` rows are written by every
mutating repository as a backend-only audit trail, not a user-facing feature.

## Accessibility

Target WCAG 2.1 AA: semantic landmarks, one `h1` per page, keyboard-operable interactive
elements, `FormField` wires labels/errors to `aria-describedby`/`aria-invalid`, status shown as
colored pills with accessible text labels (color is never the only signal).
