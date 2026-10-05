// Admin sign-in policy shared by the server config (./auth-security.ts) and the admin UI's forms
// (./two-factor.schema.ts, ./password-reset.schema.ts). No imports, so a client component can use
// it without pulling Better Auth's server plugins into the browser bundle. ADR-022, ADR-023.

/**
 * The single admin's mailbox. Every emailed code — the two-step sign-in code and the password-reset
 * code — goes here, whatever address the user row holds (ADR-023), and the reset endpoints always
 * act on this account, whatever email a client sends. It is also the admin's login email
 * (migration `20261005120000_admin_email_mandatory_2fa`).
 *
 * Importing it — or {@link ADMIN_EMAIL_MASKED} — into a client component ships the full address in
 * the browser bundle. Pass the masked string down from a Server Component instead, as the admin
 * login, forgot-password and security pages do.
 */
export const ADMIN_EMAIL = 'culpritteam@gmail.com';

const MASK = '•'; // •

/**
 * Masks the local part of an email address for display: `culpritteam@gmail.com` →
 * `cu•••••••••@gmail.com`. Shows the first two characters of a local part of 4 or more, the first
 * one of a 2–3 character local part, none of a single character, and always at least one bullet.
 * The domain is shown as-is. A string without a usable `@` is masked whole, by the same rule.
 * One bullet per hidden character, so the length is not hidden — this is a hint, not a secret.
 */
export function maskEmail(email: string): string {
  const value = email.trim();
  const at = value.lastIndexOf('@');
  const hasDomain = at > 0 && at < value.length - 1;
  const local = hasDomain ? value.slice(0, at) : value;
  const domain = hasDomain ? value.slice(at) : '';
  if (local.length === 0) return MASK;
  const visible = local.length >= 4 ? 2 : local.length >= 2 ? 1 : 0;
  return `${local.slice(0, visible)}${MASK.repeat(local.length - visible)}${domain}`;
}

/**
 * {@link ADMIN_EMAIL}, masked for display ("we sent a code to cu•••••••••@gmail.com").
 *
 * `@__PURE__` is load-bearing: client components import this file for CODE_DIGITS and friends, and
 * without the annotation the minifier must keep this call — and with it the full address — in every
 * client bundle, used or not. Annotated, an unused call and the constant it reads are dropped.
 */
export const ADMIN_EMAIL_MASKED = /* @__PURE__ */ maskEmail(ADMIN_EMAIL);

/** Both kinds of emailed code — two-factor sign-in and password reset — are this many digits. */
export const CODE_DIGITS = 8;
/** Both kinds of emailed code expire after this many minutes. */
export const CODE_TTL_MINUTES = 5;
/** Wrong guesses allowed against one two-factor code before a new one must be sent. */
export const TWO_FACTOR_CODE_ATTEMPTS = 5;
/** Wrong guesses allowed against one password-reset code before a new one must be requested. */
export const RESET_CODE_ATTEMPTS = 3;

/** Applied to every password the admin sets. Better Auth's defaults, stated so the UI can mirror them. */
export const PASSWORD_POLICY = { minPasswordLength: 8, maxPasswordLength: 128 } as const;

/**
 * `error.code`/`error.message` when a code could not be emailed (status 503) — from
 * `/two-factor/send-otp` and from `/email-otp/request-password-reset`. Nothing was sent; the
 * client may offer to try again.
 */
export const EMAIL_DELIVERY_FAILED = {
  code: 'EMAIL_DELIVERY_FAILED',
  message: "We couldn't send the code. Please try again in a moment.",
} as const;

/**
 * `error.code` when `/two-factor/send-otp`, `/two-factor/verify-otp` or
 * `/two-factor/verify-backup-code` is called from a signed-in session. Since ADR-023 codes are only
 * used to answer a sign-in challenge (after the password, before any session exists). Status 400.
 */
export const TWO_FACTOR_SIGN_IN_ONLY = {
  code: 'TWO_FACTOR_SIGN_IN_ONLY',
  message: 'Verification codes are only used while signing in.',
} as const;

/**
 * `error.code` when a correct password could not be turned into a two-step challenge — the
 * automatic enrolment failed (a database error). No session was created. Status 500.
 */
export const TWO_FACTOR_SETUP_FAILED = {
  code: 'TWO_FACTOR_SETUP_FAILED',
  message: "Sign-in couldn't be completed. Please try again.",
} as const;

/** `error.code` when production has no TURNSTILE_SECRET_KEY, so reset requests fail closed (503). */
export const CAPTCHA_NOT_CONFIGURED = {
  code: 'CAPTCHA_NOT_CONFIGURED',
  message: 'Password reset is unavailable right now. Please try again later.',
} as const;

/**
 * The password-reset request is behind Cloudflare Turnstile. The client sends the widget's token in
 * this request header (not the body) — Better Auth's captcha plugin reads it from there.
 */
export const CAPTCHA_HEADER = 'x-captcha-response';

/**
 * `error.code` when the site-wide reset-request budget (5 an hour, 10 a day, across all visitors)
 * is spent. Status 429 with a `Retry-After` header (seconds).
 */
export const RESET_BUDGET_EXHAUSTED = {
  code: 'RESET_BUDGET_EXHAUSTED',
  message: 'Too many password reset requests. Please try again later.',
} as const;
