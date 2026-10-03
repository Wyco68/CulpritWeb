import { createHmac } from 'node:crypto';
import type { BetterAuthOptions, BetterAuthPlugin, GenericEndpointContext } from 'better-auth';
import { APIError, createAuthMiddleware, getSessionFromCtx, isAPIError } from 'better-auth/api';
import { captcha, emailOTP, twoFactor } from 'better-auth/plugins';
import {
  CAPTCHA_NOT_CONFIGURED,
  CODE_DIGITS,
  CODE_TTL_MINUTES,
  EMAIL_DELIVERY_FAILED,
  EMAIL_NOT_CONFIGURED,
  PASSWORD_POLICY,
  RESET_BUDGET_EXHAUSTED,
  RESET_CODE_ATTEMPTS,
  TWO_FACTOR_CODE_ATTEMPTS,
  TWO_FACTOR_SETUP_REQUIRED,
} from './auth-policy';
import type { RateLimiter } from '@/modules/integrations';
import type { VerificationCodeSender } from './verification-code-sender';

// Admin sign-in hardening on Better Auth's own plugins (ADR-022):
//  - two-factor: after the password, an 8-digit code emailed to the admin. Email codes only — the
//    TOTP (authenticator-app) endpoints are switched off. Backup codes are the recovery path.
//  - email-otp: used for ONE thing — "forgot password" by emailed 8-digit code. Every other
//    email-otp endpoint is switched off, above all `/sign-in/email-otp`, which would let a mailbox
//    alone sign in, skipping both the password and the second factor.
//  - captcha: Cloudflare Turnstile in front of the password-reset request only.
// Kept free of env/Prisma imports so the exact plugin set can be exercised in tests against an
// in-memory adapter; ./auth.ts supplies the real dependencies. The numbers live in ./auth-policy.ts,
// shared with the admin UI's form schemas.

/**
 * Better Auth endpoints that must never answer. Enforced twice: by Better Auth's router
 * (`disabledPaths` → 404) and by a before-hook keyed on the endpoint's declared path, so a URL
 * spelling the router doesn't normalise can't reach them either.
 */
export const DISABLED_AUTH_PATHS = [
  // TOTP — authenticator apps are deferred; the second factor is an emailed code.
  '/two-factor/get-totp-uri',
  '/two-factor/verify-totp',
  // Passwordless sign-in by emailed code — would bypass the password AND the second factor.
  '/sign-in/email-otp',
  // Email verification / change by code, and the raw "send any OTP type" endpoint — unused.
  '/email-otp/send-verification-otp',
  '/email-otp/check-verification-otp',
  '/email-otp/verify-email',
  '/email-otp/request-email-change',
  '/email-otp/change-email',
  // Deprecated duplicate of /email-otp/request-password-reset.
  '/forget-password/email-otp',
  // Core link-based reset (token in a URL) — never configured; the reset is by code only. The
  // parametric callback can't match the router's literal `disabledPaths` check, so only the
  // before-hook (which compares declared paths) blocks it.
  '/request-password-reset',
  '/reset-password',
  '/reset-password/:token',
] as const;

/** The one endpoint behind Turnstile (token in the `x-captcha-response` header). */
export const CAPTCHA_PROTECTED_PATH = '/email-otp/request-password-reset';

/** Endpoints whose `trustDevice` flag would set a 30-day "skip 2FA on this browser" cookie. */
const TRUST_DEVICE_PATHS = new Set([
  '/two-factor/send-otp',
  '/two-factor/verify-otp',
  '/two-factor/verify-backup-code',
]);

// Per-request markers, keyed on the request's own context object — the same object the endpoint,
// its before-hooks and its after-hooks all receive (verified against better-auth 1.6.25, which is
// pinned; the flow tests fail if that ever stops holding). WeakSets, so a finished request's entry
// can't outlive it.
//  - failedCodeDeliveries: Better Auth's two-factor endpoint awaits `sendOTP` but swallows a
//    rejection (it only logs), so a failed delivery would still answer 200 and leave the admin
//    waiting for an email that never comes. The after-hook turns the marker into a 503.
//  - enablingRequests: a verify-otp that is confirming "turn 2FA on" (signed in, 2FA still off),
//    as opposed to answering a sign-in challenge. Only that one revokes the other sessions.
//  - resetRequestStarts: when a reset request entered the hook pipeline, for the response floor.
const failedCodeDeliveries = new WeakSet<object>();
const enablingRequests = new WeakSet<object>();
const resetRequestStarts = new WeakMap<object, number>();

/**
 * Site-wide budget for reset requests, across all IPs (per-IP limits live in src/middleware.ts).
 * Each request emails a code, and Resend's free tier allows 100 emails a day shared with the 2FA
 * sign-in codes: 10 a day keeps at least 90 for sign-in, 5 an hour spreads them out. Charged in a
 * before-hook, which runs AFTER the captcha plugin's onRequest — so only a request that passed
 * Turnstile can spend it, and a bot without tokens can't deny the admin's reset for free.
 */
export const RESET_REQUEST_GLOBAL_BUDGETS = [
  { key: 'auth-reset-request:global:hour', limit: 5, windowSeconds: 60 * 60 },
  { key: 'auth-reset-request:global:day', limit: 10, windowSeconds: 24 * 60 * 60 },
] as const;

/**
 * Every reset-request response is padded to at least this long after it reaches the hooks. The
 * unknown-address path does an extra database delete and the real-address path fires the email and
 * returns; without a floor either difference is measurable and tells an attacker which address is
 * the admin's. Padding, not constant time: a path slower than the floor still shows.
 */
export const RESET_REQUEST_RESPONSE_FLOOR_MS = 400;

type TwoFactorOtpUser = { email: string; twoFactorEnabled?: boolean | null };
type EmailOtpPayload = { email: string; otp: string; type: string };

/**
 * Keyed hash for stored codes: HMAC-SHA256 under a key derived from BETTER_AUTH_SECRET. The plugins'
 * own `'hashed'` option is an unkeyed SHA-256, and an 8-digit code has only 10^8 values — a leaked
 * `verification` row could be inverted in about a second. Without the secret it can't. Both plugins
 * store `hash(code)` and compare `hash(input)` to it in constant time.
 */
export function createOtpHasher(secret: string): { hash: (code: string) => Promise<string> } {
  // Domain-separated subkey, so this HMAC can never collide with any other use of the secret.
  const key = createHmac('sha256', secret).update('culprit:otp-hash:v1').digest();
  return {
    hash: async (code) => createHmac('sha256', key).update(code).digest('base64url'),
  };
}

/** two-factor `otpOptions.sendOTP`: the sign-in code, or the code that confirms turning 2FA on. */
export function createTwoFactorOtpSender(sender: VerificationCodeSender) {
  return async (
    { user, otp }: { user: TwoFactorOtpUser; otp: string },
    ctx?: GenericEndpointContext,
  ): Promise<void> => {
    // A sign-in challenge only exists once 2FA is on, so a code for a user without it is the one
    // that confirms switching it on (POST /two-factor/send-otp from a signed-in session).
    const purpose = user.twoFactorEnabled ? 'sign-in' : 'enable-two-factor';
    const result = await sender.send({ to: user.email, code: otp, purpose });
    if (!result.ok) {
      if (ctx) failedCodeDeliveries.add(ctx.context);
      throw result.error;
    }
  };
}

/**
 * email-otp `sendVerificationOTP`: sends ONLY the password-reset code. Any other type is dropped —
 * those endpoints are disabled, so reaching here with one means something bypassed that.
 *
 * Fire-and-forget, deliberately. `/email-otp/request-password-reset` answers `{ success: true }`
 * whether or not the address has an account; awaiting a real send only for the real address would
 * make that response measurably slower and so reveal which address is the admin's. For the same
 * reason a failed send is never surfaced (the sender has already logged it). This relies on a
 * long-running Node server (the VPS) — on a serverless host the promise would need `waitUntil`.
 */
export function createPasswordResetOtpSender(sender: VerificationCodeSender) {
  return async ({ email, otp, type }: EmailOtpPayload): Promise<void> => {
    if (type !== 'forget-password') return;
    void sender.send({ to: email, code: otp, purpose: 'password-reset' }).catch(() => {});
  };
}

export type AdminAuthGuardDeps = {
  /** Whether a real email transport is configured — see integrations' isEmailDeliveryConfigured. */
  isEmailDeliveryConfigured: () => boolean;
  /**
   * Turnstile for the password-reset request. With a secret key, Better Auth's captcha plugin
   * verifies the token. Without one: if `required` (production) the request fails closed with 503;
   * otherwise (development, tests) the check is skipped, like the site's other Turnstile gate.
   */
  captcha: { secretKey: string | undefined; required: boolean };
  /** Rate limiter per {limit, window} — integrations' getRateLimiter in production. */
  rateLimiterFor: (options: { limit: number; windowSeconds: number }) => RateLimiter;
  /** Clock and sleep for the reset response floor; injectable so tests don't wait. */
  responseFloor: { ms: number; now: () => number; sleep: (ms: number) => Promise<void> };
};

function bodyRecord(body: unknown): Record<string, unknown> {
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
}

/** Signs out every session of `userId` except `keepToken` — through Better Auth, not Prisma. */
async function revokeOtherSessions(
  ctx: GenericEndpointContext,
  userId: string,
  keepToken: string,
): Promise<void> {
  const sessions = await ctx.context.internalAdapter.listSessions(userId);
  const others = sessions.map((session) => session.token).filter((token) => token !== keepToken);
  if (others.length > 0) await ctx.context.internalAdapter.deleteSessions(others);
}

/** Project-specific guards around the stock plugins. No route handler involved — Better Auth's own. */
export function adminAuthGuards(deps: AdminAuthGuardDeps): BetterAuthPlugin {
  const disabled = new Set<string>(DISABLED_AUTH_PATHS);

  return {
    id: 'culprit-admin-auth-guards',
    hooks: {
      before: [
        {
          matcher: (ctx) => disabled.has(ctx.path ?? ''),
          handler: createAuthMiddleware(async () => {
            throw new APIError('NOT_FOUND', { message: 'Not Found' });
          }),
        },
        {
          // Lockout guard: with no way to deliver a code, switching 2FA on would lock the single
          // admin out at the next sign-in (staging and production share one database and one
          // config, so "just in development" isn't a safe exception).
          matcher: (ctx) => ctx.path === '/two-factor/enable',
          handler: createAuthMiddleware(async () => {
            if (!deps.isEmailDeliveryConfigured()) {
              throw new APIError('BAD_REQUEST', { ...EMAIL_NOT_CONFIGURED });
            }
          }),
        },
        {
          // The confirm-2FA step (signed in, 2FA still off). The plugin's verify-otp flips
          // `twoFactorEnabled` for ANY signed-in user who verifies a code — it never checks that
          // `/two-factor/enable` ran first. Without this guard, send-otp + verify-otp alone would
          // switch 2FA on with no `two_factor` row (no backup codes) and lock the admin out, since
          // the sign-in challenge needs that row. A sign-in challenge (no session) passes through.
          matcher: (ctx) =>
            ctx.path === '/two-factor/send-otp' || ctx.path === '/two-factor/verify-otp',
          handler: createAuthMiddleware(async (ctx) => {
            const session = await getSessionFromCtx(ctx);
            if (!session) return;
            const user = session.user as { id: string; twoFactorEnabled?: boolean | null };
            if (user.twoFactorEnabled) return;
            if (!deps.isEmailDeliveryConfigured()) {
              throw new APIError('BAD_REQUEST', { ...EMAIL_NOT_CONFIGURED });
            }
            const row = await ctx.context.adapter.findOne({
              model: 'twoFactor',
              where: [{ field: 'userId', value: user.id }],
            });
            if (!row) throw new APIError('BAD_REQUEST', { ...TWO_FACTOR_SETUP_REQUIRED });
            if (ctx.path === '/two-factor/verify-otp') enablingRequests.add(ctx.context);
          }),
        },
        {
          // No "trust this browser": a client-sent `trustDevice: true` is overwritten, so every
          // sign-in asks for a code.
          matcher: (ctx) => TRUST_DEVICE_PATHS.has(ctx.path ?? ''),
          handler: createAuthMiddleware(async (ctx) => ({
            context: { body: { ...bodyRecord(ctx.body), trustDevice: false } },
          })),
        },
        {
          // `/email-otp/reset-password` consumes the code BEFORE checking the new password's
          // length, so a too-short password would burn a valid code. Check it first.
          matcher: (ctx) => ctx.path === '/email-otp/reset-password',
          handler: createAuthMiddleware(async (ctx) => {
            const password = bodyRecord(ctx.body).password;
            if (typeof password !== 'string') return;
            if (password.length < PASSWORD_POLICY.minPasswordLength) {
              throw new APIError('BAD_REQUEST', {
                code: 'PASSWORD_TOO_SHORT',
                message: 'Password too short',
              });
            }
            if (password.length > PASSWORD_POLICY.maxPasswordLength) {
              throw new APIError('BAD_REQUEST', {
                code: 'PASSWORD_TOO_LONG',
                message: 'Password too long',
              });
            }
          }),
        },
        {
          // Production without a Turnstile secret: fail closed rather than serve the reset request
          // unprotected. (With a secret, the captcha plugin's onRequest has already verified.)
          matcher: (ctx) =>
            ctx.path === CAPTCHA_PROTECTED_PATH && !deps.captcha.secretKey && deps.captcha.required,
          handler: createAuthMiddleware(async () => {
            throw new APIError('SERVICE_UNAVAILABLE', { ...CAPTCHA_NOT_CONFIGURED });
          }),
        },
        {
          // Reset request: start the response-floor clock, then spend the site-wide budget. Both
          // after Turnstile (the plugin's onRequest runs before any hook), so neither costs a
          // tokenless bot anything. The hour budget is checked first and stops the day budget
          // being spent on a request it already refuses.
          matcher: (ctx) => ctx.path === CAPTCHA_PROTECTED_PATH,
          handler: createAuthMiddleware(async (ctx) => {
            resetRequestStarts.set(ctx.context, deps.responseFloor.now());
            // Hooks run before the endpoint's body validation: a body that will be rejected with
            // a 400 sends no email, so it mustn't spend a budget slot.
            if (typeof bodyRecord(ctx.body).email !== 'string') return;
            for (const budget of RESET_REQUEST_GLOBAL_BUDGETS) {
              const limiter = deps.rateLimiterFor({
                limit: budget.limit,
                windowSeconds: budget.windowSeconds,
              });
              const { success, reset } = await limiter.limit(budget.key);
              if (!success) {
                resetRequestStarts.delete(ctx.context);
                const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
                throw new APIError(
                  'TOO_MANY_REQUESTS',
                  { ...RESET_BUDGET_EXHAUSTED },
                  { 'Retry-After': String(retryAfter) },
                );
              }
            }
          }),
        },
      ],
      after: [
        {
          // Pad every reset-request response — success or error — to the floor (see above).
          matcher: (ctx) => ctx.path === CAPTCHA_PROTECTED_PATH,
          handler: createAuthMiddleware(async (ctx) => {
            const start = resetRequestStarts.get(ctx.context);
            resetRequestStarts.delete(ctx.context);
            if (start === undefined) return;
            const remaining = deps.responseFloor.ms - (deps.responseFloor.now() - start);
            if (remaining > 0) await deps.responseFloor.sleep(remaining);
          }),
        },
        {
          matcher: (ctx) => ctx.path === '/two-factor/send-otp',
          handler: createAuthMiddleware(async (ctx) => {
            if (!failedCodeDeliveries.has(ctx.context)) return;
            failedCodeDeliveries.delete(ctx.context);
            // 503, not 502: Cloudflare replaces an origin's 502 body with its own error page.
            throw new APIError('SERVICE_UNAVAILABLE', { ...EMAIL_DELIVERY_FAILED });
          }),
        },
        {
          // `/two-factor/enable` also returns a TOTP provisioning URI — the TOTP secret itself.
          // TOTP is switched off, so it is useless to the client and is not sent.
          matcher: (ctx) => ctx.path === '/two-factor/enable',
          handler: createAuthMiddleware(async (ctx) => {
            const returned = ctx.context.returned;
            if (returned && typeof returned === 'object' && 'backupCodes' in returned) {
              return ctx.json({ backupCodes: (returned as { backupCodes: string[] }).backupCodes });
            }
          }),
        },
        {
          // Turning 2FA on or off signs out every other session. On: a session opened before the
          // second factor existed shouldn't outlive it — that is the security reason. Off: for
          // consistency, so every change to the sign-in requirements starts from one session. It
          // does NOT protect against an attacker who disables 2FA — it would sign the real admin
          // out, not them. Both endpoints have already rotated the caller's own session into
          // `newSession`, which is the one kept.
          matcher: (ctx) =>
            ctx.path === '/two-factor/verify-otp' || ctx.path === '/two-factor/disable',
          handler: createAuthMiddleware(async (ctx) => {
            const enabling = enablingRequests.has(ctx.context);
            enablingRequests.delete(ctx.context);
            if (ctx.path === '/two-factor/verify-otp' && !enabling) return;
            if (isAPIError(ctx.context.returned)) return;
            const current = ctx.context.newSession;
            if (!current) return;
            await revokeOtherSessions(ctx, current.user.id, current.session.token);
          }),
        },
      ],
    },
  };
}

export type AdminAuthPluginDeps = AdminAuthGuardDeps & {
  codeSender: VerificationCodeSender;
  /** BETTER_AUTH_SECRET — keys the stored-code hash (createOtpHasher). */
  otpHashSecret: string;
};

/** Turnstile on the reset request when a secret is configured; otherwise an inert placeholder. */
function resetCaptcha(deps: AdminAuthGuardDeps): BetterAuthPlugin {
  if (!deps.captcha.secretKey) return { id: 'culprit-reset-captcha-off' };
  return captcha({
    provider: 'cloudflare-turnstile',
    secretKey: deps.captcha.secretKey,
    // Only the reset request. NOT sign-in (yet) — the plugin's default list includes
    // /sign-in/email, which is deliberately left out of this change.
    endpoints: [CAPTCHA_PROTECTED_PATH],
  });
}

/** The full plugin set, in one place, so ./auth.ts and the tests configure Better Auth identically. */
export function adminAuthPlugins(
  deps: AdminAuthPluginDeps,
): [
  ReturnType<typeof twoFactor>,
  ReturnType<typeof emailOTP>,
  ReturnType<typeof adminAuthGuards>,
  BetterAuthPlugin,
] {
  const otpHasher = createOtpHasher(deps.otpHashSecret);
  // An explicit tuple, not the inferred `(A | B | C)[]`: Better Auth infers the session's user
  // fields (e.g. `twoFactorEnabled`) per plugin, which a widened array loses.
  return [
    twoFactor({
      issuer: 'The Culprit',
      // Enabling only takes effect once an emailed code is verified (verify-otp flips the flag).
      skipVerificationOnEnable: false,
      totpOptions: { disable: true },
      otpOptions: {
        digits: CODE_DIGITS,
        period: CODE_TTL_MINUTES, // minutes, in this plugin
        allowedAttempts: TWO_FACTOR_CODE_ATTEMPTS,
        storeOTP: otpHasher,
        sendOTP: createTwoFactorOtpSender(deps.codeSender),
      },
      // Encrypted with a key derived from BETTER_AUTH_SECRET (the plugin's symmetricEncrypt).
      backupCodeOptions: { storeBackupCodes: 'encrypted' },
    }),
    emailOTP({
      otpLength: CODE_DIGITS,
      expiresIn: CODE_TTL_MINUTES * 60, // seconds, in this plugin
      allowedAttempts: RESET_CODE_ATTEMPTS,
      storeOTP: otpHasher,
      disableSignUp: true,
      sendVerificationOTP: createPasswordResetOtpSender(deps.codeSender),
    }),
    adminAuthGuards(deps),
    resetCaptcha(deps),
  ];
}

/**
 * The security-relevant slice of the Better Auth config — credentials, disabled endpoints and the
 * plugin set — in one place, so ./auth.ts and the flow tests run exactly the same configuration.
 */
export function adminAuthSecurityOptions(deps: AdminAuthPluginDeps) {
  return {
    emailAndPassword: {
      enabled: true,
      // Single admin only — no public registration. The credential is seeded from env, never a form.
      disableSignUp: true,
      ...PASSWORD_POLICY,
      // A completed reset signs out every existing session. The email-otp reset path checks this
      // same option. The admin then signs in again — through 2FA, if it's on.
      revokeSessionsOnPasswordReset: true,
    },
    disabledPaths: [...DISABLED_AUTH_PATHS],
    plugins: adminAuthPlugins(deps),
  } satisfies Partial<BetterAuthOptions>;
}
