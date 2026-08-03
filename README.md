# The Culprit

Personal academic website and admin-controlled appointment system for an information-security
professor, built on Next.js 15.

## Docs

- **[Project Spec](https://wyco68.github.io/CulpritWeb/)** — full requirements, data model, API
  surface, and architecture.
- **[Development Progress](https://wyco68.github.io/CulpritWeb/progress.html)** — current status,
  what's shipped, what's next.

## Development

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and fill in the required values before running the app.

Common scripts:

```bash
npm run build       # prisma generate && next build
npm run typecheck
npm run lint
npm run test         # Vitest
npm run test:e2e     # Playwright
npm run db:migrate   # prisma migrate dev
```
