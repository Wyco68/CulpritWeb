---
status: current
source_of_truth: false
last_updated: 2026-08-08
related_modules: [auth]
related_decisions: [ADR-003]
---

# Authentication

## Provider

**Better Auth** (`src/modules/auth/auth.ts`), **not Supabase Auth** — evaluated and explicitly
rejected to avoid running two competing auth systems. See
[ADR-003](../decisions/ADR-003-authentication.md).

```ts
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  secret: env.BETTER_AUTH_SECRET,
  emailAndPassword: { enabled: true, disableSignUp: true },
  session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
  advanced: { cookiePrefix: 'culprit' },
});
```

## Model

- **Exactly one administrator.** `disableSignUp: true` — no public registration route exists at
  all. The credential is seeded from `ADMIN_EMAIL`/`ADMIN_INITIAL_PASSWORD` via `prisma/seed.ts`,
  never created through a form.
- **Sessions are DB-backed, cookie-identified — not JWT.** The cookie (`culprit`-prefixed) holds
  an opaque signed token; server state (the `Session` table, owned by Better Auth's Prisma
  adapter) is the source of truth, so a session can be revoked instantly.
- Session lifetime: 7 days, rolling renewal every 24h (`updateAge`).
- `trustedOrigins` is built from `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL`.

## Session handling

- Better Auth's own route handler serves `/api/auth/[...all]` (login, logout, session reads).
- Server-side session reads go through `requireAdmin()`
  (`src/modules/auth/require-admin.ts`), which calls `auth.api.getSession({ headers })` — reads
  straight from the DB, so a revoked session takes effect immediately (not just cookie
  presence/cache).

## Authorization boundary

**There is no `middleware.ts` in this project.** The admin guard is a single server-side check in
`src/app/(admin)/admin/layout.tsx`:

```ts
const session = await requireAdmin();
if (!session.ok) redirect('/login');
```

Every page under `/admin/*` is a child of this layout, so one `requireAdmin()` call guards the
whole section, re-evaluated on every navigation (Server Components aren't cached the way a
client-side route guard would be). This differs from
`.claude/skills/fullstack-nextjs-starter/references/security.md`'s description of a
`middleware.ts`-based gate "re-checked" in each handler as a second layer — in the shipped app,
the layout check **is** the only server-side gate for page routes; admin **API routes**
additionally call `requireAdmin()` themselves (see `architecture/backend.md`), so the "re-check at
the boundary, not just middleware" principle still holds — there's just no middleware layer to
begin with.

Single-admin MVP: any authenticated Better Auth user is treated as the admin. `requireAdmin()`'s
own comment notes where a `role === 'admin'` check would go if a second admin role is ever added —
additive, no call-site changes needed.
