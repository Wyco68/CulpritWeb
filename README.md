# The Culprit

Personal academic website + admin-controlled appointment system for an information-security
professor, built on Next.js 15 (App Router). Public site (Bio, Research, Publications, Research
Groups, Upcoming Events, Make Appointment) + a single-admin backend (login, content CRUD,
appointment management, settings).

This README is a map for a new developer. It doesn't repeat what's already documented
elsewhere — it tells you **where to look** and **what order to read things in**.

## Start here, in this order

1. **[CLAUDE.md](CLAUDE.md)** — hard project rules (layering, auth model, what's explicitly
   out of scope) and which specialist AI subagent owns which kind of work. Read this even if
   you're a human, not an agent — the rules apply either way.
2. **[PROJECT_SPEC.md](PROJECT_SPEC.md)** — the actual requirements: data model, API surface,
   appointment lifecycle, permissions. This is the source of truth when anything else disagrees.
3. **[docs/README.md](docs/README.md)** — index of the `docs/` tree: current architecture,
   requirements, ADRs (*why* decisions were made), deployment. Also lists known places where the
   spec or an old reference doc has drifted from the real code — check it before trusting either.
4. **[AGENTS.md](AGENTS.md)** — the workflow for using `docs/` before/after making a change
   (search it, check for a relevant ADR, don't silently reintroduce something an ADR removed).

Search everything at once:

```bash
npm run docs:search -- "appointment workflow"
```

Rendered, browsable versions of the spec and a few status pages are also published via GitHub
Pages: [spec](https://wyco68.github.io/CulpritWeb/) ·
[progress](https://wyco68.github.io/CulpritWeb/progress.html) ·
[frontend](https://wyco68.github.io/CulpritWeb/frontend.html) ·
[backend](https://wyco68.github.io/CulpritWeb/backend.html) ·
[deployment](https://wyco68.github.io/CulpritWeb/deployment.html). These are convenience mirrors
of files in this repo, not a separate source — the `.md`/`docs/` files above are canonical.

## What this app actually is, in one paragraph

A public academic site (all pages server-rendered, cached, and fast) sitting in front of a
single-admin backend (Better Auth, secure cookie sessions, no JWT, no public sign-up). Content
(research, publications, team members, research groups) is plain CRUD behind admin auth.
Appointments are **admin-declared only** — there's no visitor-facing request/approve workflow;
the admin creates a scheduled appointment directly, and the only lifecycle transition is
`scheduled → cancelled` (never hard-deleted). Calendly is embedded client-side for the actual
booking UI; nothing about it touches the server (see
[ADR-005](docs/decisions/ADR-005-calendly-embed-only.md)).

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in real values — see below
npm run dev
```

You need at minimum a Supabase Postgres connection (`DATABASE_URL`/`DIRECT_URL`) and
`BETTER_AUTH_SECRET` for the app to boot. Everything else in `.env.example` (Turnstile, R2,
Resend, Cloudflare purge) is optional — each integration no-ops gracefully when its env vars are
unset, so local dev never gets blocked waiting on a third-party credential.

```bash
npm run build        # prisma generate && next build
npm run typecheck
npm run lint
npm test              # Vitest, unit + component tests
npm run test:e2e      # Playwright
npm run db:migrate    # prisma migrate dev (local schema changes)
npm run db:seed       # seed data
```

Run `npm run typecheck && npm run lint && npm test` before considering any change done — see
[AGENTS.md](AGENTS.md#after-modifying-code) for the full post-change checklist (including when a
doc or ADR needs updating alongside the code).

## Architecture, in one paragraph

Modular, feature-first, strictly layered: **route handler → service → repository → Prisma**.
Route handlers do auth + validation + call a service, nothing else — no business logic in
`src/app/api/**`. Services hold business rules (including the appointment state machine).
Repositories are the *only* place Prisma is imported. Every mutating repository writes an
`AuditLog` row (backend-only trail; there is no admin-facing audit-log viewer, and none is
planned). Full detail: [docs/architecture/overview.md](docs/architecture/overview.md).

Modules (`src/modules/*`): `auth`, `profile`, `research`, `publications`, `research-groups`,
`appointments`, `settings`, `integrations` (Calendly embed metadata, R2 storage, Resend, Turnstile,
rate limiting), `shared` (the response envelope, error types, logger, cache/revalidation helpers —
see below).

## Caching and rate limiting — read before touching either

These are easy to get subtly wrong, and this project already hit real bugs in both, so read the
ADRs before changing anything here:

- **[ADR-007](docs/decisions/ADR-007-fix-cache-invalidation-and-cache-public-api-routes.md)** —
  which public routes are cached, at what TTL, how admin writes invalidate them (Next's
  `revalidatePath`, plus an optional Cloudflare edge purge), and the exact `Vary` handling needed
  so RSC/prefetch requests don't collide with plain page loads in Cloudflare's cache. Has two
  dated corrections on top of the original decision — both are real bugs that shipped and were
  caught later, worth reading so you don't repeat them.
- **[ADR-008](docs/decisions/ADR-008-cloudflare-rate-limiting.md)** — two-layer rate limiting
  (Cloudflare edge WAF rule in front of the app, in-process fallback behind it), scoped to the
  login endpoint and admin mutations only. Explains why there's no Redis, and the Cloudflare
  Free-plan limits that shaped the design (1 rate-limiting rule per zone).

If you're adding a new public GET route: use `respondPublicCache`/`withPublicCache`
(`src/modules/shared/lib/api-response.ts`) rather than hand-rolling a `Cache-Control` header, and
add the route to the relevant `PublicArea` in `src/modules/shared/lib/revalidate.ts` so an admin
edit actually invalidates it. **Never** read `request.nextUrl.searchParams` inside a route handler
you want statically cached — it forces the route dynamic (this exact mistake shipped twice; see
ADR-007's corrections). Do the query-param handling in `src/middleware.ts` instead if you need it
pre-route.

## Deployment

Self-hosted: one prebuilt Docker container on a VPS, behind Cloudflare — see
[docs/deployment/docker-vps.md](docs/deployment/docker-vps.md). CI builds the image and pushes it
to GHCR; the VPS only ever pulls and runs it (`scripts/deploy.sh`), never builds. Cloudflare sits
in front (proxied DNS, WAF rate-limit rule, Cache Rules) — the Cloudflare-side configuration itself
lives in the Cloudflare dashboard, not this repo; ADR-007/ADR-008 describe what's configured and
why.

## Hard constraints (see [CLAUDE.md](CLAUDE.md) for the full list)

- Every third-party service must work on its **free tier** — don't add a feature that needs a
  paid plan.
- **No Redis**, added or reintroduced, unless a new ADR documents a measured reason.
- **Single admin, cookie sessions, no JWT.**
- **No i18n** — removed deliberately (ADR-006); don't reintroduce `next-intl` or locale routing.
- **Appointments are never hard-deleted** — `cancelled` is a retained state.
- **Calendly is embed-only** — no server-side PAT/REST client/webhook receiver.

## Subagents (if you're an AI agent, or using one)

`CLAUDE.md`'s **Subagent routing** table says which specialist agent (`backend-developer`,
`frontend-developer`, `code-reviewer`, `qa-reviewer`, etc.) owns which kind of change, and when to
just make a small edit inline instead. Read it before spawning anything.
