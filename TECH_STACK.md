# The Culprit — Technology Stack

Aligned to [PROJECT_SPEC.md](PROJECT_SPEC.md). Each entry states what the technology does **in this
project** — no generic product descriptions.

---

## Framework & language

### Next.js 15 (App Router)
- Public site tabs: Bio, Research, Publications, Research Groups, Upcoming Events, Make Appointment.
- Admin app: Login, Dashboard, content CRUD, Manage Appointments, Settings, Audit log.
- Route Handlers are the API boundary (`auth → validate → service → response`); **no business logic
  in handlers**.
- Server Components render public content; SEO for the academic profile.

---

## UI layer

### Tailwind CSS v4
- Responsive layouts for cards, forms, appointment tables, dashboard.

### shadcn/ui
- Buttons, Cards, Dialogs, Tables (appointment list), Inputs, Dropdowns, Toasts, Nav.
- Status pills for appointment states: `pending · approved · declined · booked · cancelled`.

### Lucide Icons
- Nav, status badges, action buttons. Tree-shakeable.

### next-themes
- Light / Dark / System.

### next-intl
- English default; no hardcoded user-facing strings (spec non-functional requirement). Future
  languages via translation files.

---

## Forms & validation

### React Hook Form
- Appointment request form (name, email, research group, time, topic), Login, admin CRUD, Settings.

### Zod
- **Server-side validation at every API boundary is the source of truth**; client copy is UX only.
- One schema per module.

### TanStack Query v5
- Admin dashboard + Manage Appointments data fetching, caching, background refetch, loading/error
  states.

---

## Data & backend

### Prisma ORM
- **Imported only in repositories.** CRUD for Profile, Research, Publications, Research Groups,
  Appointments, Settings, AuditLog.
- Migrations via `prisma migrate deploy` in CI; pooled `DATABASE_URL` for app, `DIRECT_URL` for
  migrations.

### PostgreSQL (Neon)
- Stores all entities + audit logs. **Not** photos/PDFs (URLs only).
- Appointment records **never hard-deleted** — `declined`/`cancelled` are retained states.
- Connection pooling mandatory in serverless (Neon pooler).

### Better Auth
- **Single admin, secure cookie sessions — not JWT.** Seeded from `ADMIN_EMAIL` /
  `ADMIN_INITIAL_PASSWORD`. Gates all `/api/admin/*` routes.

---

## Object storage (adapter)

### Cloudflare R2
- Interface-based storage adapter.
- Holds professor photo, CV, PDFs, event images. DB stores only the URL reference (`photo_url`, etc.).
- R2: S3-compatible, no egress fees.
---

## Email

### Resend + React Email
- Transactional email on each appointment transition: received (`pending`/`booked`), approved,
  declined, cancelled.
- Templates authored as React components → HTML → sent via Resend.

---

## Scheduling integration

### Calendly (embed + metadata only)
- Embedded **free** widget on Make Appointment tab and admin booking step; default slot **30 min**.
- **No webhooks / no sync / no paid auto-book** (spec NG1, NG2, F1 deferred).
- Direct booking → status `booked` (`source=direct`). Approved requests booked **manually** by
  admin, then **Mark booked** stores `calendly_event_ref`.

---

## Abuse protection

### Cloudflare Turnstile
- Bot challenge on appointment request form and login. `NEXT_PUBLIC_TURNSTILE_SITE_KEY` +
  server-only `TURNSTILE_SECRET_KEY`.

### Upstash Redis
- Rate limiting at the API edge on appointment + login endpoints (e.g. 5 requests/hour).

---

## Testing

### Vitest
- Unit tests: validation, services, appointment state machine, business logic.

### React Testing Library
- Component tests: forms, dialogs, buttons, status pills, user interactions.

### Playwright
- E2E: login, full appointment lifecycle (request → approve → mark booked → email), CRUD.

---

## Deployment(Changeable later)

### Vercel
- Deploy, HTTPS, CDN, preview builds. CI gate `typecheck → lint → test`; `prisma migrate deploy` on
  release. Security headers incl. CSP allowing Calendly frame origin (per env-deploy guide).
- Alternative per Appendix 14.1: Cloudflare Pages/Workers + D1/Postgres + R2.

---

## Architecture

```
Users
  │
Vercel ──► Next.js 15
  │          ├── Public tabs · Admin tabs · Calendly embed (client)
  │          ├── Route Handlers (auth → validate → service → repository)
  │          └── Better Auth (cookie session)
  │
  ├── PostgreSQL (Neon) ── Profile · Research · Publications · Groups · Appointments · Settings · AuditLog
  ├── Object storage (R2 ⇄ Supabase) ── photos · CV · PDFs · event images (URLs in DB)
  ├── Resend + React Email ── appointment lifecycle notifications
  ├── Upstash Redis ── rate limiting
  ├── Turnstile ── bot defense
  └── Calendly (free embed) ── direct booking + calendly_event_ref
```

Modules: `auth · profile · research · publications · research-groups · appointments · settings ·
notifications · integrations · shared`.
