// Admin sign-in policy shared by the server config (./auth-security.ts) and the admin UI's forms
// (./two-factor.schema.ts, ./password-reset.schema.ts). No imports, so a client component can use
// it without pulling Better Auth's server plugins into the browser bundle. ADR-022.

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

/** `error.code`/`error.message` the server answers with when 2FA is refused for lack of email. */
export const EMAIL_NOT_CONFIGURED = {
  code: 'EMAIL_NOT_CONFIGURED',
  message: "Two-step verification can't be turned on: this site can't send email yet.",
} as const;

/** `error.code`/`error.message` when a two-factor code could not be emailed (status 503). */
export const EMAIL_DELIVERY_FAILED = {
  code: 'EMAIL_DELIVERY_FAILED',
  message: "We couldn't send the code. Please try again in a moment.",
} as const;

/**
 * `error.code` when a signed-in admin requests or submits the confirm-2FA code without first
 * calling `twoFactor.enable({ password })` (or while email is unconfigured — that case answers
 * `EMAIL_NOT_CONFIGURED`). Status 400.
 */
export const TWO_FACTOR_SETUP_REQUIRED = {
  code: 'TWO_FACTOR_SETUP_REQUIRED',
  message: 'Start turning on two-step verification with your password first.',
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
