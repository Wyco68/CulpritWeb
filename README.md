# The Culprit

Personal academic website + admin-controlled appointment system for an information-security
professor, built on Next.js 15 (App Router).

**Live site:** [culprit.wyco-dev.com](https://culprit.wyco-dev.com)

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in real values
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

Run `npm run typecheck && npm run lint && npm test` before considering any change done.

## Docs

- **[docs/README.md](docs/README.md)** — index of the `docs/` tree: architecture, requirements,
  ADRs (*why* decisions were made), deployment.
- **[AGENTS.md](AGENTS.md)** — workflow for using `docs/` before/after making a change.
- **[docs/decisions/](docs/decisions/)** — one ADR per significant decision. Read the relevant one
  before touching caching (ADR-007), rate limiting (ADR-008), or deployment (ADR-009).

Search all of it at once:

```bash
npm run docs:search -- "appointment workflow"
```

Rendered status pages, published from this repo via GitHub Pages:
[spec](https://wyco68.github.io/CulpritWeb/) ·
[progress](https://wyco68.github.io/CulpritWeb/progress.html) ·
[frontend](https://wyco68.github.io/CulpritWeb/frontend.html) ·
[backend](https://wyco68.github.io/CulpritWeb/backend.html) ·
[deployment](https://wyco68.github.io/CulpritWeb/deployment.html) ·
[hosting cost](https://wyco68.github.io/CulpritWeb/hosting-cost.html).

## Deployment

Self-hosted: one prebuilt Docker container on a VPS, behind Cloudflare — see
[docs/deployment/docker-vps.md](docs/deployment/docker-vps.md). CI builds the image and pushes it
to GHCR; the VPS only ever pulls and runs it (`scripts/deploy.sh`), never builds.
