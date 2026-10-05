---
status: current
source_of_truth: true
last_updated: 2026-10-05
related_modules: [auth, integrations]
related_decisions: [ADR-003, ADR-008, ADR-013, ADR-021, ADR-022]
---

# ADR-023: Mandatory admin two-step verification, with every code sent to one fixed mailbox

## Status

Accepted. Supersedes parts of [ADR-022](ADR-022-admin-2fa-and-password-reset-otp.md): two-step
verification is no longer optional, the enable/disable flow is gone, and the password reset no
longer takes an email address or hides its outcome. Everything else in ADR-022 still holds: the
plugins, 8-digit codes, keyed code hashing, attempt limits and lockout, no TOTP, no "trust this
browser", Turnstile and the site-wide budget on reset requests, and the disabled endpoints.

## Date

2026-10-05

## Context

ADR-022 shipped two days earlier. On production the admin found three problems:

1. **Sign-in never asked for a code.** Two-step verification was opt-in, and nobody had turned it
   on, so a password alone still signed in.
2. **Forgot password asked for the admin's email address.** The page had to say "if that email
   belongs to the admin, a code is on its way" to avoid revealing which address it was.
3. **No code ever arrived.** The admin account's email was a test address with no mailbox behind
   it. The reset answered `{ success: true }` either way, by design, so nothing showed the failure.

The opt-in design and the uniform response were both choices made for general-purpose accounts.
This site has exactly one account, and the team owns its mailbox: `culpritteam@gmail.com`.

## Decision

### One fixed mailbox

`ADMIN_EMAIL = 'culpritteam@gmail.com'` is a constant in `src/modules/auth/auth-policy.ts` (a file
with no imports, so the UI can use it too). `ADMIN_EMAIL_MASKED` (`cu•••••••••@gmail.com`) and
`maskEmail()` are there for display.

- **Every code goes there.** `VerificationCodeSender.send({ code, purpose })` has no recipient
  parameter; it always mails `ADMIN_EMAIL`. The address on the user row is never used for delivery,
  for the sign-in code or the reset code.
- **It is also the login email.** Migration `20261005120000_admin_email_mandatory_2fa` renames the
  existing admin to it, and `prisma/seed.ts` provisions a fresh admin with it. The `ADMIN_EMAIL`
  environment variable is no longer read.
- Changing the mailbox is now a code change plus a migration, not a config change. That is
  deliberate: one shared Doppler config serves every environment (ADR-013), and the address that
  receives sign-in codes should be reviewed like code.

### Two-step verification is mandatory

There is no opt-in and no off switch.

- **Automatic enrolment at the first password sign-in.** An after-hook on `/sign-in/email` in the
  project's guard plugin runs when the password was correct. If the account has no `two_factor` row
  or its `two_factor_enabled` flag is off, the hook:
  - creates the row the way `/two-factor/enable` would: an encrypted random secret
    (`symmetricEncrypt` under the auth secret), ten encrypted backup codes in the plugin's own
    storage format, and `verified: false` so TOTP is never offered against it;
  - sets the flag through Better Auth's internal adapter, never through Prisma;
  - marks the in-flight session's user as enrolled.

  The two-factor plugin's own sign-in hook runs next. It sees the flag, deletes the session the
  password created, and answers `{ twoFactorRedirect: true, twoFactorMethods: ["otp"] }`.

- **Hook order is load-bearing.** Better Auth 1.6.25 runs plugin after-hooks in plugin order
  (`dispatch.mjs#getHooks`). The guard plugin is therefore listed **before** `twoFactor` in
  `adminAuthPlugins`. The flow tests fail if the order is swapped.
- **Fails closed.**
  - If enrolment throws (a database error), the session is deleted, its cookie expired, and the
    sign-in answers `500 TWO_FACTOR_SETUP_FAILED`.
  - A backstop plugin placed **after** `twoFactor` checks every `/sign-in/email` response. If a
    session is still live — the two-factor plugin didn't challenge, for whatever reason — it
    destroys the session (row and cookie) even when the response is already an error, revokes every
    "trust this browser" record of the user and expires that cookie, and turns a would-be success
    into the same 500. The only stock path that skips the challenge is a valid trust-device cookie,
    which this app never issues; the tests forge one to prove the backstop.
  - **Concurrent first sign-ins.** `two_factor.user_id` is unique (see Migration), so of several
    simultaneous first sign-ins only one insert wins. A failed insert re-reads the row: if one
    exists, the account is enrolled and the sign-in continues to its challenge; if none does, the
    error is rethrown and the sign-in fails closed. Re-reading, not matching the driver's error
    code, keeps this adapter-independent.
- **Turning 2FA on or off is gone.** `/two-factor/enable` and `/two-factor/disable` are in
  `DISABLED_AUTH_PATHS` (404).
- **Codes only answer a sign-in challenge.** `/two-factor/send-otp`, `/two-factor/verify-otp` and
  `/two-factor/verify-backup-code` called from a signed-in session answer
  `400 TWO_FACTOR_SIGN_IN_ONLY`. Their only session-backed use was confirming "turn 2FA on".
- **Backup codes stay.** `/two-factor/generate-backup-codes` (signed in, password required)
  replaces them; `/two-factor/verify-backup-code` accepts one at sign-in. The codes written at
  enrolment are never shown to anyone, so the admin generates a usable set from the Security page.
- **Removed:** the `EMAIL_NOT_CONFIGURED` guard on enabling, the enable-step guard
  (`TWO_FACTOR_SETUP_REQUIRED`), revoking other sessions on enable/disable, and stripping the TOTP
  URI from the enable response. Both error constants were deleted once the admin UI stopped mapping
  them (same change set).

### Forgot password without an email address

- Before-hooks on `/email-otp/request-password-reset` and `/email-otp/reset-password` overwrite
  `body.email` with `ADMIN_EMAIL`. Before-hooks run before the endpoint validates its body, so the
  client may send `{}`, `{ email: '' }`, any address, or no body at all. The UI should send
  `email: ''`, which satisfies the client's types.
- **The send is awaited and its outcome reported.** A reset request answers
  `503 EMAIL_DELIVERY_FAILED` when the email fails, using the same per-request marker and after-hook
  pattern as the two-factor send. It answers the same 503 if no account has `ADMIN_EMAIL`; the
  endpoint skips the send silently in that case, so the hook logs
  `password_reset_account_missing`.
- **Removed:** the 400 ms response floor, and the fire-and-forget send handed to Next's `after()`.
  Both existed only to hide whether the typed address was the admin's. With a fixed recipient there
  is nothing left to hide, and a silently missing email was the actual failure.
- **Kept:** Turnstile in the `x-captcha-response` header, the site-wide budget (5 an hour, 10 a
  day), and the password-length check before the code is spent. The budget no longer skips requests
  without an email, since every request now has one.

### Migration

`20261005120000_admin_email_mandatory_2fa`, hand-written:

- **Renames the admin.** It sets `user.email` to `culpritteam@gmail.com`.
  - Only `user.email` changes. Better Auth 1.6.25 writes `account.account_id = user.id` for a
    credential account (`sign-up.mjs`), and sign-in finds the credential by `user_id`, never by
    email. The password keeps working.
  - With **more than one** user it raises and changes nothing, because there is no safe way to pick
    the admin.
  - With **no** users it does nothing. Raising there would break every fresh database, including
    the empty shadow database `prisma migrate dev` replays all migrations into. The seed creates
    the admin afterwards.
- **Signs everyone out.** `DELETE FROM "session"`: every existing session was opened with a password
  alone.
- **Revokes trusted browsers.** `DELETE FROM "verification" WHERE identifier LIKE 'trust-device-%'`.
  None should exist (the app never issued one), but one is the only way past the challenge.
- **One `two_factor` row per user.** Duplicates are deleted first, keeping the lowest `id` per
  `user_id` (none are expected: before this change only `/two-factor/enable` wrote rows, and it
  deletes a user's rows before inserting). Then `two_factor_user_id_idx` is replaced by the unique
  `two_factor_user_id_key` — exactly what an offline `prisma migrate diff --from-schema
--to-schema` generates for `userId @unique` (with `User.twoFactor TwoFactor?`, the one-to-one
  shape Prisma requires for a unique foreign key). The plugin stays compatible: it reads the row
  with `findOne` and updates it by `id` (`generate-backup-codes`, `verify-backup-code`, lockout);
  `/two-factor/enable`, the only path that inserts, deletes first and is disabled anyway.
- **Checked against a throwaway Postgres** (no network, never the shared database). All migrations
  replay on an empty database and end with the indexes `schema.prisma` describes. A single admin is
  renamed; its sessions and trust records are cleared (other verification rows stay); three
  duplicate `two_factor` rows are reduced to the lowest id; the unique index then rejects a new
  duplicate. With two users it raises before any write. Like every Prisma migration it runs once:
  the index swap is not written to be re-run.

`prisma/seed.ts` now skips once any user exists, whatever its email. Keyed on the email alone, the
rename would have made the next seed run create a second admin.

## Alternatives considered

- **Keep 2FA opt-in, and nag on the dashboard until it's on.** Rejected. It leaves the
  password-only path open indefinitely, which is the problem the admin reported.
- **Enrol in the migration instead of at sign-in.** SQL can't produce the encrypted secret and
  backup codes, which need the app's `BETTER_AUTH_SECRET`. Setting only the flag would have locked
  the admin out: the plugin's sign-in verify requires a `two_factor` row (`TWO_FACTOR_NOT_ENABLED`).
- **Enrol on the plugin's `/two-factor/enable` path, forced at the first sign-in.** That path needs
  a signed-in session, so it requires a password-only session first. That is exactly what must
  never exist.
- **Look up the admin's actual login email for the reset**, rather than overwriting with the
  constant. It would survive a stale user row, but it hides a mismatch the migration is meant to
  remove, and it adds a query for every request. The 503 plus the `password_reset_account_missing`
  log surface the mismatch instead.
- **A configurable recipient** (an environment variable). Rejected: see "One fixed mailbox".

## Consequences

- **Sign-in now depends on email delivery, everywhere.** With no working transport, the only way in
  is a backup code.
  - In production, a missing `RESEND_API_KEY`/`EMAIL_FROM` is logged at boot
    (`email_delivery_unconfigured`) and every code request answers 503.
  - In development, with no transport, codes are written to the server log
    (`verification_code_dev_only`), so local sign-in keeps working.
  - **Break-glass**, if email is down and no backup codes were saved: anyone with Doppler access can
    run the app locally without a mail transport, read the code from the server log
    (`verification_code_dev_only`), and sign in against the shared database. That access already
    implies full database access, so this opens nothing new. The exact command is in the go-live
    checklist below.
  - ADR-022's last resort (`UPDATE "user" SET two_factor_enabled = false`) no longer works. The next
    sign-in simply re-enrols.
- **Resend's sandbox only delivers to the Resend account owner.** Without a verified sending
  domain, `EMAIL_FROM` has to be Resend's test sender, and Resend only delivers to the address that
  owns the Resend account. Either the Resend account belongs to `culpritteam@gmail.com`, or a domain
  is verified in Resend and `EMAIL_FROM` is an address on it.
- **The mailbox is still both factors.** ADR-022's warning stands, and is now concentrated on one
  address: whoever controls `culpritteam@gmail.com` can reset the password and receive the sign-in
  code. That account needs its own strong 2FA.
- **The reset no longer hides anything.** Its response shows whether email delivery works. That is
  acceptable: the recipient is public in the code and fixed.

## Go-live checklist

Sign-in fails closed without email, so these run **in this order**. The migration touches the one
Supabase database staging and production share.

0. **Before merging — prove the exact key/sender pair delivers to the admin mailbox**, in both
   places that run the app. Each command reads the key from the environment, never echoes it, and
   prints only Resend's JSON answer (`{"id":"…"}` on success). Then check the inbox _and_ spam of
   `culpritteam@gmail.com`. Resend's sandbox sender only delivers to the Resend account owner's
   address — if the mail doesn't arrive, fix that (verify a domain, or own the Resend account with
   this mailbox) before going further.

   Doppler `culprit/stg` (what the VPS staging runs with):

   ```sh
   doppler run --project culprit --config stg -- sh -c 'curl -sS https://api.resend.com/emails \
     -H "Authorization: Bearer $RESEND_API_KEY" -H "Content-Type: application/json" \
     -d "{\"from\":\"$EMAIL_FROM\",\"to\":[\"culpritteam@gmail.com\"],\"subject\":\"Resend check (Doppler stg)\",\"text\":\"If this arrived, admin sign-in codes will too.\"}"; echo'
   ```

   Vercel production (its variables are set by hand, so check them separately; the pulled file
   holds every production secret — delete it straight away):

   ```sh
   vercel env pull /tmp/culprit-vercel-prod.env --environment=production \
     && sh -c 'set -a; . /tmp/culprit-vercel-prod.env; set +a; curl -sS https://api.resend.com/emails \
       -H "Authorization: Bearer $RESEND_API_KEY" -H "Content-Type: application/json" \
       -d "{\"from\":\"$EMAIL_FROM\",\"to\":[\"culpritteam@gmail.com\"],\"subject\":\"Resend check (Vercel prod)\",\"text\":\"If this arrived, admin sign-in codes will too.\"}"; echo'; \
     rm -f /tmp/culprit-vercel-prod.env
   ```

   (`EMAIL_FROM` is interpolated into the JSON, so it must not itself contain a double quote — the
   usual `The Culprit <no-reply@domain>` form is fine.)

1. **Merge.** CI runs the tests, then its `migrate` job applies
   `20261005120000_admin_email_mandatory_2fa` to the shared database, then the VPS image is built
   and deployed. From the migration on, the admin's login is `culpritteam@gmail.com` (same password)
   and every session is signed out.
2. **Immediately, sign in on staging and generate backup codes.** Password, then the emailed code;
   this first sign-in also enrols the account. Then, on the Security page, generate backup codes
   and store them offline — the set written at enrolment is never shown, so until this step there
   is no recovery path. Until this sign-in, the old production code still accepts the renamed
   account with a password alone (its 2FA was opt-in and off); once the account is enrolled, the
   old code challenges too. So do this right after the migration.
3. **Deploy Vercel production by hand.**

**Rollback is safe.** The previous code works with the renamed account. It also challenges, because
the flag is now on, and emails `user.email`, which is now the same mailbox.

**Break-glass — email down, no backup codes.** From a checkout with Doppler access, with nothing
else listening on port 3000:

```sh
doppler run --project culprit --config stg -- env RESEND_API_KEY= npx next dev
```

Sign in at `http://localhost:3000/login`; the code is printed in this terminal as
`verification_code_dev_only`. The session is local — make the fix (or generate backup codes) from
there. Why exactly this command:

- **Not `doppler run -- env RESEND_API_KEY= npm run dev`.** `npm run dev` is itself
  `doppler run -- next dev`, and `doppler run` gives Doppler's values precedence over the
  environment (`--preserve-env` defaults to false), so the real key comes straight back and the
  code is emailed, not logged.
- **And `npm run dev` migrates the shared database first** — its `predev` script is
  `doppler run -- prisma migrate deploy`. Calling `next dev` directly skips both.
- An empty `RESEND_API_KEY` is read as unset (`env.server.ts` maps `''` to `undefined`), and
  `next dev` runs with `NODE_ENV=development`, the only mode that logs codes.
- Port 3000 matters: outside production, `http://localhost:3000` is the only local origin in
  `trustedOrigins`, so a sign-in from another port is refused.

## Supersedes / Superseded by

Supersedes, in [ADR-022](ADR-022-admin-2fa-and-password-reset-otp.md):

- the opt-in model, "Turning it on", the enable-step guard and the session revocation on
  enable/disable;
- the uniform reset response, its 400 ms floor and the background send;
- the `EMAIL_NOT_CONFIGURED` lockout guard;
- the "last resort" recovery note.

Extends ADR-003 the same way ADR-022 did: still Better Auth DB-backed cookie sessions, a single
admin, no JWT.
