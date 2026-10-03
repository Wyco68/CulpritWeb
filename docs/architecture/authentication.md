---
status: current
source_of_truth: false
last_updated: 2026-10-03
related_modules: [auth, integrations]
related_decisions: [ADR-003, ADR-008, ADR-022]
---

# Authentication

## Provider

**Better Auth** (`src/modules/auth/auth.ts`), **not Supabase Auth** — evaluated and explicitly
rejected to avoid running two competing auth systems. See
[ADR-003](../decisions/ADR-003-authentication.md).

```ts
export const auth = betterAuth({
  appName: 'The Culprit',
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL,
  trustedOrigins,
  // emailAndPassword (sign-up off, 8–128 chars, sessions revoked on reset), disabledPaths, and
  // plugins [twoFactor, emailOTP, guards] — see src/modules/auth/auth-security.ts (ADR-022)
  ...adminAuthSecurityOptions({ codeSender, isEmailDeliveryConfigured }),
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

## Second factor and password reset (ADR-022)

Both by **8-digit code emailed** through `EmailClient` (Resend), via Better Auth plugins configured
in `src/modules/auth/auth-security.ts`; the shared numbers live in `auth-policy.ts`.

- **Two-step verification** (`twoFactor` plugin, email codes only, off until the admin turns it
  on): password → `{ twoFactorRedirect: true }` → `/two-factor/send-otp` → `/two-factor/verify-otp`
  (or `/two-factor/verify-backup-code`). No TOTP, no trust-this-browser. Turning it on is refused
  (`EMAIL_NOT_CONFIGURED`) while no email transport is configured.
- **Forgot password** (`emailOTP` plugin, this flow only): `/email-otp/request-password-reset`
  (uniform `{ success: true }`) → `/email-otp/reset-password`, which revokes every session and does
  not sign in.
- **Disabled** (404): `/sign-in/email-otp` and every other email-otp endpoint, the TOTP endpoints,
  and the link-based `/request-password-reset` + `/reset-password`.
- Turning 2FA on or off signs out every other session. The confirm-2FA code is refused
  (`TWO_FACTOR_SETUP_REQUIRED`) unless `/two-factor/enable` ran first.
- The reset request needs a Turnstile token in the `x-captcha-response` header (Better Auth
  `captcha` plugin, that endpoint only; fails closed in production without `TURNSTILE_SECRET_KEY`).
  Its response is uniform, doesn't wait for the email, and is padded to a 400 ms floor.
- Codes are stored as an HMAC keyed from `BETTER_AUTH_SECRET` in `verification`; backup codes
  encrypted in `two_factor`.
- Per-IP limits in `src/middleware.ts` (ADR-008 fallback): reset requests 3 / 10 min, 2FA sends
  5 / 10 min, checks 10 / 10 min. The site-wide reset-request budget (5 / hour, 10 / day — Resend's
  free tier is 100 emails/day) is a Better Auth before-hook, charged only after Turnstile passes;
  `429 RESET_BUDGET_EXHAUSTED` + `Retry-After`. The client IP is only trustworthy once the Caddy
  change in `docs/deployment/docker-vps.md` is applied — see ADR-022's deploy checklist.
- `better-auth` is pinned to an exact version; a test enumerates every routed endpoint.
- The email template is `src/modules/auth/emails/verification-code-email.tsx`; delivery is
  `verification-code-sender.ts` (logs the code instead in development when no transport is set).

### Admin UI routes

| Route                    | Gate                                                                | What it does                                                                                                                                                                                                                                          |
| ------------------------ | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/login`                 | none (redirects to `/admin` if signed in)                           | `LoginForm`: password, then — when 2FA is on — an in-place code step (emailed code, or "Use a backup code instead"). The first code is sent from the password submit handler, never an effect. No separate 2FA page.                                  |
| `/login/forgot-password` | none (reachable signed in too — there is no change-password screen) | `ForgotPasswordForm`: email → uniform "if that email belongs to the admin, a code is on its way" → code + new password. Success → `/login`.                                                                                                           |
| `/admin/security`        | admin layout                                                        | `TwoFactorSettings`: on/off state read server-side (`requireAdmin().twoFactorEnabled`), turn on (password → backup codes shown once → emailed code), turn off, replace backup codes. Turn on is disabled when `isEmailDeliveryConfigured()` is false. |

All three map Better Auth errors to copy through one helper,
`src/modules/auth/ui/auth-error-message.ts`. A 429 is decided by status, not code: the middleware's
own 429 body leaves `error.code` undefined on the client, and `ACCOUNT_TEMPORARILY_LOCKED` gets its
own message. `INVALID_TWO_FACTOR_COOKIE` sends the sign-in back to the password step;
`TWO_FACTOR_SETUP_REQUIRED` sends the turn-on dialog back to its password step. "Resend code"
buttons wait 45 s between sends (`use-resend-cooldown.ts`).

- **Turnstile on the reset form.** `HumanCheck` (`src/modules/auth/ui/human-check.tsx`) wraps the
  shared `TurnstileWidget` (`src/modules/integrations/turnstile/turnstile-widget.tsx`, which the
  Calendly gate's `TurnstileChallenge` also renders through). "Send code" stays disabled until a
  token exists; every request — the first and each "Resend code" — spends one token and remounts
  the check. Resend opens the check on demand and sends as soon as it passes. With no
  `NEXT_PUBLIC_TURNSTILE_SITE_KEY` no check is shown. Captcha errors (`MISSING_RESPONSE`,
  `VERIFICATION_FAILED`, `UNKNOWN_ERROR`, `CAPTCHA_NOT_CONFIGURED`), 429, 5xx and network failures
  keep the visitor on the email step; any other answer moves on with the uniform message.
- **Backup codes are never lost silently.** While fresh codes are on screen and "I've saved these"
  is unticked, Escape, the close button, the backdrop and Cancel ask "Close without saving these
  codes?" in the dialog footer instead of closing.

## Session handling

- Better Auth's own route handler serves `/api/auth/[...all]` (login, logout, session reads, and
  the two-factor / password-reset endpoints above).
- Server-side session reads go through `requireAdmin()`
  (`src/modules/auth/require-admin.ts`), which calls `auth.api.getSession({ headers })` — reads
  straight from the DB, so a revoked session takes effect immediately (not just cookie
  presence/cache).

## Authorization boundary

**`src/middleware.ts` exists (added 2026-08-10), but it does not guard admin auth** — it applies
only an in-process rate-limit fallback to `/api/auth/*` and mutating `/api/admin/*` requests, see
[ADR-008](../decisions/ADR-008-cloudflare-rate-limiting.md) and
[architecture/backend.md](backend.md). The admin **page** guard is a separate, single server-side
check in `src/app/(admin)/admin/layout.tsx`:

```ts
const session = await requireAdmin();
if (!session.ok) redirect('/login');
```

Every page under `/admin/*` is a child of this layout, so one `requireAdmin()` call guards the
whole section, re-evaluated on every navigation (Server Components aren't cached the way a
client-side route guard would be). This differs from
the original implementation guide's description of a
`middleware.ts`-based gate "re-checked" in each handler as a second layer — in the shipped app,
the layout check **is** the only server-side gate for admin **page** routes; admin **API routes**
additionally call `requireAdmin()` themselves (see `architecture/backend.md`), so the "re-check at
the boundary, not just middleware" principle still holds. `src/middleware.ts` (ADR-008) runs on
`/api/admin/*` too, but only as a rate-limit fallback — it never makes an authorization decision;
`requireAdmin()` inside each route handler remains the only thing that does.

Single-admin MVP: any authenticated Better Auth user is treated as the admin. `requireAdmin()`'s
own comment notes where a `role === 'admin'` check would go if a second admin role is ever added —
additive, no call-site changes needed.
