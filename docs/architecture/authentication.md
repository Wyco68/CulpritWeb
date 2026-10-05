---
status: current
source_of_truth: false
last_updated: 2026-10-05
related_modules: [auth, integrations]
related_decisions: [ADR-003, ADR-008, ADR-022, ADR-023]
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
  // plugins [guards, twoFactor, emailOTP, captcha, backstop] — ORDER MATTERS, see
  // src/modules/auth/auth-security.ts (ADR-022, ADR-023)
  ...adminAuthSecurityOptions({ codeSender, logger, otpHashSecret, captcha, rateLimiterFor }),
  session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
  advanced: { cookiePrefix: 'culprit' },
});
```

## Model

- **Exactly one administrator**, signing in as **`culpritteam@gmail.com`** — the constant
  `ADMIN_EMAIL` in `src/modules/auth/auth-policy.ts` (ADR-023). `disableSignUp: true` — no public
  registration route exists at all. The credential is seeded by `prisma/seed.ts` with that email and
  `ADMIN_INITIAL_PASSWORD` (the `ADMIN_EMAIL` env var is no longer read), only while no user exists,
  never created through a form.
- **Sessions are DB-backed, cookie-identified — not JWT.** The cookie (`culprit`-prefixed) holds
  an opaque signed token; server state (the `Session` table, owned by Better Auth's Prisma
  adapter) is the source of truth, so a session can be revoked instantly.
- Session lifetime: 7 days, rolling renewal every 24h (`updateAge`).
- `trustedOrigins` is built from `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL`.

## Second factor and password reset (ADR-022, ADR-023)

Both by **8-digit code emailed** through `EmailClient` (Resend), via Better Auth plugins configured
in `src/modules/auth/auth-security.ts`; the shared numbers live in `auth-policy.ts`. **Every code
goes to `ADMIN_EMAIL` (`culpritteam@gmail.com`)** — the sender has no recipient parameter, and the
user row's address is never used for delivery. `ADMIN_EMAIL_MASKED` / `maskEmail()` are for display.

- **Two-step verification is mandatory** (`twoFactor` plugin, email codes only). Every password
  sign-in answers `{ twoFactorRedirect: true, twoFactorMethods: ["otp"] }` and no session →
  `/two-factor/send-otp` → `/two-factor/verify-otp` (or `/two-factor/verify-backup-code`). No TOTP,
  no trust-this-browser.
  - **Automatic enrolment.** The first password sign-in of an account without 2FA creates its
    `two_factor` row (encrypted secret + backup codes, in the plugin's own format) and sets
    `two_factor_enabled`, through Better Auth's adapters, in an after-hook that runs **before** the
    two-factor plugin's own — so even that first sign-in is challenged. `two_factor.user_id` is
    unique; when concurrent first sign-ins race, the losing insert re-reads the winner's row and
    continues to the challenge.
  - **Fails closed.** Enrolment failure → the new session is deleted, `500 TWO_FACTOR_SETUP_FAILED`.
    A backstop plugin after `twoFactor` destroys any session a password sign-in would still return
    (even on an error response) and revokes the user's "trust this browser" records.
  - `/two-factor/enable` and `/two-factor/disable` are disabled (404). `send-otp`, `verify-otp` and
    `verify-backup-code` from a signed-in session answer `400 TWO_FACTOR_SIGN_IN_ONLY`.
  - Backup codes: `/two-factor/generate-backup-codes` (signed in, password) replaces them; the set
    written at enrolment is never shown, so the admin generates one from the Security page.
- **Forgot password** (`emailOTP` plugin, this flow only): `/email-otp/request-password-reset` →
  `/email-otp/reset-password`. Both **ignore the client's `email`** and act on `ADMIN_EMAIL` (a
  before-hook overwrites it ahead of body validation; send `email: ''`). The send is awaited:
  `{ success: true }` means the email went out; a failed send — or no account with `ADMIN_EMAIL` —
  answers `503 EMAIL_DELIVERY_FAILED`. The reset revokes every session and does not sign in.
- **Disabled** (404): enable/disable, `/sign-in/email-otp` and every other email-otp endpoint, the
  TOTP endpoints, and the link-based `/request-password-reset` + `/reset-password`.
- The reset request needs a Turnstile token in the `x-captcha-response` header (Better Auth
  `captcha` plugin, that endpoint only; fails closed in production without `TURNSTILE_SECRET_KEY`).
- Codes are stored as an HMAC keyed from `BETTER_AUTH_SECRET` in `verification`; backup codes
  encrypted in `two_factor`.
- Per-IP limits in `src/middleware.ts` (ADR-008 fallback): reset requests 3 / 10 min, 2FA sends
  5 / 10 min, checks 10 / 10 min, backup-code replacement 10 / 10 min. The site-wide reset-request
  budget (5 / hour, 10 / day — Resend's free tier is 100 emails/day) is a Better Auth before-hook,
  charged only after Turnstile passes; `429 RESET_BUDGET_EXHAUSTED` + `Retry-After`. The client IP
  is only trustworthy once the Caddy change in `docs/deployment/docker-vps.md` is applied — see
  ADR-022's deploy checklist.
- **Email delivery is required to sign in.** Production logs `email_delivery_unconfigured` at boot
  without `RESEND_API_KEY`/`EMAIL_FROM`; then only a backup code gets in. In development with no
  transport the code is written to the server log (`verification_code_dev_only`) instead.
- **Going live / break-glass** — the ordered checklist is in
  [ADR-023](../decisions/ADR-023-mandatory-admin-2fa-fixed-recipient.md#go-live-checklist):
  (0) before merging, send a real test email with the exact `RESEND_API_KEY`/`EMAIL_FROM` pair from
  Doppler `stg` and from Vercel to `culpritteam@gmail.com`; (1) merge — CI migrates the shared
  database; (2) sign in at once and generate backup codes; (3) deploy Vercel by hand. Break-glass
  is `doppler run --project culprit --config stg -- env RESEND_API_KEY= npx next dev` — **not**
  `npm run dev`, whose nested `doppler run` restores the key and whose `predev` migrates the shared
  database.
- `better-auth` is pinned to an exact version; a test enumerates every routed endpoint, and the flow
  tests fail if the plugin order (which the enrolment depends on) changes.
- The email template is `src/modules/auth/emails/verification-code-email.tsx` (purposes `sign-in`,
  `password-reset`); delivery is `verification-code-sender.ts`.

### Admin UI routes

| Route                    | Gate                                                                | What it does                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------ | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/login`                 | none (redirects to `/admin` if signed in)                           | `LoginForm`: email + password, then — on every sign-in — an in-place code step ("We sent an 8-digit code to cu•••••••••@gmail.com"; or "Use a backup code instead"). The first code is sent from the password submit handler, never an effect. A password step that answers without `twoFactorRedirect` is shown as a failure, never treated as a sign-in. No separate 2FA page. |
| `/login/forgot-password` | none (reachable signed in too — there is no change-password screen) | `ForgotPasswordForm`, no email field: a short explanation + human check + "Send reset code" → code + new password + confirm ("We sent a code to cu•••••••••@gmail.com"), sending `email: ''` to both endpoints. Every request failure, `503 EMAIL_DELIVERY_FAILED` included, keeps the visitor on the first step. Success → toast + `/login`.                                    |
| `/admin/security`        | admin layout                                                        | `TwoFactorSettings`: "Two-step verification is always on. Sign-in codes are emailed to cu•••••••••@gmail.com." and a backup-codes section ("Generate backup codes": password → codes shown once). A prominent warning that sign-in codes can't be sent when `isEmailDeliveryConfigured()` is false. No turn-on/turn-off controls.                                                |

**The full address never reaches the browser.** Each page is a Server Component that passes
`ADMIN_EMAIL_MASKED` to its client form as `maskedEmail`; no client file imports `ADMIN_EMAIL`,
`ADMIN_EMAIL_MASKED` or `maskEmail`. The client forms do import `auth-policy.ts` for
`CODE_DIGITS` and the like, so `ADMIN_EMAIL_MASKED`'s `maskEmail(ADMIN_EMAIL)` call carries a
`/* @__PURE__ */` annotation: without it the minifier has to keep the call, and with it the address,
in every client bundle. `src/modules/auth/ui/__tests__/client-bundle.test.ts` checks both halves
with an esbuild bundle.

All three map Better Auth errors to copy through one helper,
`src/modules/auth/ui/auth-error-message.ts`. A 429 is decided by status, not code: the middleware's
own 429 body leaves `error.code` undefined on the client, and `ACCOUNT_TEMPORARILY_LOCKED` gets its
own message. `INVALID_TWO_FACTOR_COOKIE` sends the sign-in back to the password step.
`TWO_FACTOR_SETUP_FAILED` reads "Sign-in couldn't be completed. Please try again.";
`TWO_FACTOR_SIGN_IN_ONLY` (a code step in a browser that is already signed in) asks for a reload,
which `/login` turns into the dashboard. The reset request words `EMAIL_DELIVERY_FAILED` as "We
couldn't send the email. Try again in a few minutes." and its 429 from `Retry-After`. "Resend code"
buttons wait 45 s between sends (`use-resend-cooldown.ts`).

- **Turnstile on the reset form.** `HumanCheck` (`src/modules/auth/ui/human-check.tsx`) wraps the
  shared `TurnstileWidget` (`src/modules/integrations/turnstile/turnstile-widget.tsx`, which the
  Calendly gate's `TurnstileChallenge` also renders through). "Send reset code" stays disabled until
  a token exists; every request — the first and each "Resend code" — spends one token and remounts
  the check. Resend opens the check on demand, and a passed check only enables "Send new code": the
  request always needs a click. With no `NEXT_PUBLIC_TURNSTILE_SITE_KEY` no check is shown.
- **Backup codes are never lost silently.** While fresh codes are on screen and "I've saved these"
  is unticked, Escape, the close button and the backdrop ask "Close without saving these codes?" in
  the dialog footer instead of closing.
- **Authenticated e2e specs reuse a saved session.** A spec can't read the emailed code, so
  `tests/e2e/support/admin-session.ts` loads a Playwright storage state a person recorded once
  (`npx playwright codegen --save-storage=…`), named by `E2E_ADMIN_STORAGE_STATE`; without it those
  specs skip. Sign-in itself is not relaxed for tests.

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
