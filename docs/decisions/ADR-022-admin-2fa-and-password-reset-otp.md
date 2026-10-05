---
status: current
source_of_truth: true
last_updated: 2026-10-03
related_modules: [auth, integrations]
related_decisions: [ADR-003, ADR-008, ADR-013, ADR-021]
---

# ADR-022: Admin two-step verification and password reset by emailed 8-digit code

## Status

Accepted. Revised the same day after a security review: keyed code hashing, site-wide reset
budgets, Turnstile on the reset request, a padded reset response time, session revocation on 2FA
changes, and a guard against switching 2FA on without the enable step. Revised again after a
re-review: the site-wide reset budget moved behind Turnstile, and the reset response is padded to a
time floor.

## Date

2026-10-03

## Context

The single admin signed in with a password alone, and a forgotten password had no recovery path
short of re-running the seed against the database. For an information-security lab, a single
factor on the only account that can change the public site is the weakest point. Two things were
needed:

1. a **second factor** after the password, and
2. a **forgot-password** flow that doesn't need someone with database access.

Constraints: the project stays on free tiers (ADR-021), uses Better Auth cookie sessions, not JWT
(ADR-003), and has one admin who should not have to install anything.

## Decision

Both features use **Better Auth's own plugins**, configured in `src/modules/auth/auth-security.ts`.
Both send an **8-digit numeric code by email** through the existing `EmailClient` (Resend). This is
the `EmailClient`'s first caller. `better-auth` is pinned to an exact version (`1.6.25`), because
several guards below depend on how its hook pipeline behaves. A test lists every routed endpoint and
fails when an upgrade adds one.

### Two-step verification

This is the `twoFactor` plugin with **email codes only**.

- **Signing in.** After a correct password, `POST /api/auth/sign-in/email` answers
  `{ twoFactorRedirect: true, twoFactorMethods: ["otp"] }` instead of a session. The client then
  requests a code (`/two-factor/send-otp`) and submits it (`/two-factor/verify-otp`). The code is
  8 digits, valid for 5 minutes, and allows 5 wrong guesses before a new one must be sent. On top
  of that, the plugin locks the account for 15 minutes after 10 consecutive failures.
- **Turning it on** takes the password (`/two-factor/enable`, which creates the `two_factor` row
  and the backup codes), then a code emailed to the admin and verified from the signed-in session.
  Only that verification flips `user.two_factor_enabled`.
- **Enable-step guard.** The plugin's `verify-otp` flips the flag for any signed-in user who
  verifies a code, even without `/enable`. That would leave 2FA on with no `two_factor` row: no
  backup codes, and a sign-in challenge that can never succeed, so the admin is locked out. A
  before-hook on `send-otp` and `verify-otp` therefore checks two things when the caller is signed
  in and 2FA is still off:
  - a `two_factor` row must exist, otherwise the request fails with `400 TWO_FACTOR_SETUP_REQUIRED`;
  - email must be configured, otherwise `400 EMAIL_NOT_CONFIGURED`.
- **Session revocation.** Turning 2FA on or off signs out every other session; the caller's
  freshly rotated session is the one kept.
  - On: a session opened before the second factor existed shouldn't outlive it.
  - Off: for consistency, so every change to the sign-in requirements starts from one session.
    It does not protect against an attacker who turns 2FA off: it would sign the real admin out,
    not them.

  An ordinary 2FA sign-in revokes nothing.

- **Backup codes** (10, one-time, `xxxxx-xxxxx`) are the recovery path if the mailbox is
  unreachable. They are stored encrypted, with a key derived from `BETTER_AUTH_SECRET` (the
  plugin's `symmetricEncrypt`).
- **No authenticator app (TOTP) for now.** `/two-factor/get-totp-uri` and `/two-factor/verify-totp`
  are disabled. The TOTP provisioning URI, which contains the seed, is stripped from the enable
  response.
- **No "trust this browser".** A client-sent `trustDevice` is overwritten server-side, so every
  sign-in asks for a code.

### Forgot password

This is the `emailOTP` plugin, used for **this one flow only**.

- **Requesting a code.** `POST /api/auth/email-otp/request-password-reset { email }` emails an
  8-digit code (5 minutes, 3 wrong guesses). It needs a Cloudflare Turnstile token in the
  `x-captcha-response` header (Better Auth's `captcha` plugin, scoped to this one endpoint).
- **Uniform response.** It answers `{ success: true }` whether or not the address has an account,
  and whether or not the email went out.
  - The send is **not awaited**, so a real address doesn't wait on the email provider. It is
    handed to Next's `after()`, which keeps it running past the response on a serverless host
    (Vercel production) as well as on the VPS's long-running server.
    `advanced.backgroundTasks` must stay unset, because it would also stop the two-factor send from
    being awaited and break the 503 below.
  - The two paths still differ (an unknown address costs an extra database delete), so the
    **response time is padded to a floor of 400 ms**, measured from when the request reaches Better
    Auth's hooks. This is padding, not constant time: a request slower than the floor, for example
    a slow database, still shows its own duration. Requests refused before the hooks (Turnstile,
    rate limits) aren't padded; they reveal nothing about the address.
- **Resetting.** `POST /api/auth/email-otp/reset-password { email, otp, password }` sets the new
  password and **revokes every session** (`revokeSessionsOnPasswordReset`). The reset does not sign
  the admin in: they sign in normally afterwards, and pass 2FA if it is on. A reset does not turn
  2FA off.
- **Password checked first.** The new password's length is checked **before** the code. Better
  Auth spends the code first, so without this a too-short password would burn a valid code.

### Disabled endpoints

Every other email-OTP endpoint is switched off. This is enforced through Better Auth's
`disabledPaths` and through a before-hook keyed on each endpoint's declared path:

- `/sign-in/email-otp` — most importantly: passwordless sign-in by code would let a mailbox alone
  bypass both the password and the second factor;
- `/email-otp/send-verification-otp`, `/email-otp/check-verification-otp`,
  `/email-otp/verify-email`, `/email-otp/request-email-change`, `/email-otp/change-email`;
- the deprecated `/forget-password/email-otp`;
- Better Auth's link-based `/request-password-reset` and `/reset-password`, and its parametric
  callback `/reset-password/:token`. The router's literal `disabledPaths` check can't express that
  one, so only the hook blocks it.

### Storage

Both kinds of code are stored in the existing `verification` table as **HMAC-SHA256 under a key
derived from `BETTER_AUTH_SECRET`**, never as sent. The plugins' built-in `'hashed'` option was
rejected: it is an unkeyed SHA-256, and with only 10⁸ possible codes a leaked row can be inverted in
about a second. Both plugins store `hash(code)` and compare `hash(input)` to it in constant time.

The two-factor plugin adds `user.two_factor_enabled` and a `two_factor` table, holding:

- the encrypted backup codes;
- the unused encrypted TOTP seed;
- the lockout counters;
- a `verified` flag.

The migration `20261003120000_two_factor` is additive.

### Abuse limits

These are layered, and each one is cheap because there is a single admin.

**Better Auth's built-in per-endpoint limits** apply in production.

**Per-IP limits** in the middleware fallback (ADR-008):

| Endpoint       | Limit         | Notes                                                  |
| -------------- | ------------- | ------------------------------------------------------ |
| Reset requests | 3 per 10 min  |                                                        |
| 2FA code sends | 5 per 10 min  | Needs a pending password-proven challenge or a session |
| Code checks    | 10 per 10 min | The sign-in code and backup codes share one budget     |
| 2FA settings   | 10 per 10 min | `enable` / `disable` / `generate-backup-codes`, shared |

**Site-wide budget for reset requests**, against attacks spread over many IPs: 5 an hour and 10 a
day across all visitors. When it is spent, the request gets `429 RESET_BUDGET_EXHAUSTED` with a
`Retry-After` header.

- **It is charged after Turnstile.** The budget lives in a Better Auth before-hook, not in the
  middleware. In better-auth 1.6.25 the router runs every plugin's `onRequest` (where the captcha
  plugin verifies) before any `hooks.before`. A request without a valid token is refused first and
  costs nothing, so the budget can't be drained for free. An earlier version charged it in the
  middleware, before Turnstile, which let anyone deny the admin's reset without solving a single
  challenge.
- **Why 10 a day.** Resend's free tier allows **100 emails a day** (3,000 a month), shared with the
  2FA sign-in codes. Capping reset requests at 10 a day leaves at least 90 for sign-in, so a reset
  flood cannot starve the admin of sign-in codes.
- **The cost.** Someone who solves Turnstile 10 times a day can still block the admin's own reset
  until the budget refills.

There is no site-wide cap on reset _attempts_. Guesses are already bounded: 3 per code, and codes
are bounded by the request budget above.

**Turnstile** on the reset request. In production without `TURNSTILE_SECRET_KEY`, the request fails
closed (`503 CAPTCHA_NOT_CONFIGURED`). In development without it, the check is skipped, like the
site's other Turnstile gate. Sign-in is not behind Turnstile in this change.

**Client IP.** The per-IP limits and Turnstile's `remoteip` are only as good as the client IP the
app sees. Behind Cloudflare and the shared Caddy, that is currently a Cloudflare edge address.
`docs/deployment/docker-vps.md#client-ip-behind-cloudflare--manual-follow-up-not-yet-applied` has
the Caddy fix, applied by hand.

### Delivery failures and the lockout guard

**Lockout guard.** With no email transport configured, `/two-factor/enable` is refused with
`EMAIL_NOT_CONFIGURED`. Otherwise the admin could switch on a factor that can never be delivered.
This applies in every environment, because staging, production and local development share one
database and one Doppler config. Turning 2FA on "just locally" turns it on everywhere.

**Failed sends.** If a code fails to send, `/two-factor/send-otp` answers
`503 EMAIL_DELIVERY_FAILED`. The plugin's default would answer 200 and leave the admin waiting for a
code that never comes. It is 503 rather than 502 because Cloudflare replaces an origin's 502 body
with its own page.

### Local development

With `RESEND_API_KEY`/`EMAIL_FROM` unset and `NODE_ENV` not `production`, a code is written to the
server log (`verification_code_dev_only`) instead of being emailed. Codes are never logged in
production.

The reset request needs a Turnstile token when `TURNSTILE_SECRET_KEY` is set. The shared Doppler
config holds the production key pair, and production site keys don't work on `localhost` unless
it's added to the widget's hostnames. For local testing, override both with Cloudflare's always-pass
test keys:

- site key `1x00000000000000000000AA`;
- secret `1x0000000000000000000000000000000AA`.

A production secret rejects the test widget's dummy token.

## Alternatives considered

- **Supabase Auth MFA.** The database is already on Supabase, but Supabase MFA has no email
  factor. Its factors are TOTP and phone, and phone is a paid add-on. It also issues JWTs and ties
  users to its own `auth.users` schema. Adopting it would mean replacing the working Better Auth
  cookie sessions (ADR-003) and breaking the no-JWT rule to gain a factor the admin didn't ask for.
- **An authenticator app (TOTP).** Stronger: the second factor isn't the same channel as the
  password reset. **Deferred, not rejected.** The plugin already supports it, and the `two_factor`
  table already holds a seed. Turning it on later means re-enabling the two disabled endpoints and
  adding a QR-code setup screen; no schema change is needed.

  **Mind `two_factor.verified` when doing so.** The email-code enable path never sets it to true;
  the row keeps whatever `/enable` wrote (false on a first enable). The plugin only offers TOTP at
  sign-in when `verified` is not false, and only `verify-totp` marks it verified. If TOTP is added,
  existing rows need deliberate handling, either re-enrolment or a one-off update, so that TOTP
  isn't silently unavailable, or offered against a seed the admin never scanned.

- **A reset link (magic link) instead of a code.** A link carries a bearer token in a URL, which
  ends up in mail-scanner logs and browser history. A short-lived code typed into the page that
  asked for it doesn't.
- **SMS codes.** Not free, and SIM-swap is a known weakness.
- **The plugins' `'hashed'` code storage.** Rejected as above: unkeyed, so trivially invertible
  for 8-digit codes.

## Consequences

- **The mailbox is both the reset channel and the second factor.** Someone who controls the
  admin's mailbox can reset the password and then receive the sign-in code, which is a full
  takeover. 2FA by email therefore protects against a **leaked or guessed password**, not against a
  **compromised mailbox**. The admin's mailbox should itself be protected by its own 2FA. Moving
  the second factor to an authenticator app (above) is what would close this gap.
- **Email delivery becomes a dependency of signing in.** If Resend is down or misconfigured while
  2FA is on, the admin signs in with a **backup code**. If those are lost too, the last resort is a
  direct database update: `UPDATE "user" SET two_factor_enabled = false WHERE email = '…'`.
- **New required secrets for this feature:** `RESEND_API_KEY` and `EMAIL_FROM` in the Doppler
  `culprit/stg` config (ADR-013). `EMAIL_FROM` must be an address on a domain verified in Resend;
  without a verified domain Resend only delivers to the account owner's own address. Until both are
  set, 2FA cannot be turned on, and password-reset codes are logged in development and dropped in
  production. `TURNSTILE_SECRET_KEY` (already used by the Calendly gate) is now required in
  production for the reset request to work at all.
- **Resend's free tier fits only because of the site-wide caps.** Normal use is a handful of codes
  a month; the caps above keep abuse from consuming the daily allowance.
- **Rate-limit state is in-process** (ADR-008), so it resets when the container restarts. On
  Vercel each function instance keeps its own counters, so the site-wide reset caps are per
  instance there, not truly global; Turnstile on every reset request is the control that still
  holds. A shared store (e.g. Upstash Redis, free tier) would make the caps exact.
- **Changing `BETTER_AUTH_SECRET`** invalidates outstanding codes (5-minute lifetime, so harmless)
  and makes stored backup codes undecryptable. Regenerate backup codes after rotating it.
- **No `AuditLog` rows are written for sign-ins, 2FA changes or resets.** Better Auth owns those
  tables, and no auth event has been audited before this change either. Auditing them would be a
  separate decision.

## Deploy checklist

Before this ships to an environment people use:

1. **Apply the Caddy client-IP change** in
   `docs/deployment/docker-vps.md#client-ip-behind-cloudflare--manual-follow-up-not-yet-applied`.
   Until then every per-IP limit is keyed on a Cloudflare edge address.
2. **Set `RESEND_API_KEY` and `EMAIL_FROM`** in the Doppler `culprit/stg` config. `EMAIL_FROM` must
   be on a domain verified in Resend. Without these, 2FA can't be turned on, and in production reset
   codes are dropped.
3. **Check `TURNSTILE_SECRET_KEY` and `NEXT_PUBLIC_TURNSTILE_SITE_KEY` are both set.** Without the
   secret, production refuses reset requests (503). Without the site key, the page shows no widget
   and every request is refused; the server logs `turnstile_misconfigured` at boot.
4. **The migration `20261003120000_two_factor` applies to the shared production database** on the
   next `prisma migrate deploy` (CI, or the `predev` hook of `npm run dev`). It is additive, so the
   order of migration and deploy doesn't matter.

## Follow-ups (not done)

- Bind the Turnstile check to this form: an `expectedAction` and a hostname allowlist, so a token
  minted for the Calendly gate (same site key) can't be spent here.
- Run the auth flow tests against a real Postgres-backed adapter, not only the in-memory one.
- Email the admin when 2FA is turned off or the password is reset, so an unexpected change is
  noticed.
- Audit-log auth events (see Consequences).

## Supersedes / Superseded by

Extends ADR-003 (it does not replace it): sessions are still Better Auth DB-backed cookies, single
admin, no JWT. ADR-003's "no password reset" consequence no longer holds. There is now a reset, by
emailed code, though still no magic link and no social login.
