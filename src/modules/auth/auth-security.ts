import { createHmac } from 'node:crypto';
import type { BetterAuthOptions, BetterAuthPlugin, GenericEndpointContext } from 'better-auth';
import { APIError, createAuthMiddleware, getSessionFromCtx, isAPIError } from 'better-auth/api';
import { deleteSessionCookie, expireCookie } from 'better-auth/cookies';
import { generateRandomString, symmetricEncrypt } from 'better-auth/crypto';
import { captcha, emailOTP, twoFactor } from 'better-auth/plugins';
import {
  ADMIN_EMAIL,
  CAPTCHA_NOT_CONFIGURED,
  CODE_DIGITS,
  CODE_TTL_MINUTES,
  EMAIL_DELIVERY_FAILED,
  PASSWORD_POLICY,
  RESET_BUDGET_EXHAUSTED,
  RESET_CODE_ATTEMPTS,
  TWO_FACTOR_CODE_ATTEMPTS,
  TWO_FACTOR_SETUP_FAILED,
  TWO_FACTOR_SIGN_IN_ONLY,
} from './auth-policy';
import type { RateLimiter } from '@/modules/integrations';
import type { Logger } from '@/modules/shared/lib/logger';
import type { VerificationCodeSender } from './verification-code-sender';

// Admin sign-in hardening on Better Auth's own plugins (ADR-022, ADR-023):
//  - two-factor: MANDATORY. Every password sign-in is answered with a challenge, and only an
//    8-digit code emailed to ADMIN_EMAIL (or a backup code) turns it into a session. There is no
//    opt-in and no off switch: `/two-factor/enable` and `/two-factor/disable` are disabled, and an
//    account without 2FA is enrolled automatically at its first password sign-in. Email codes only
//    — the TOTP (authenticator-app) endpoints are switched off. Backup codes are the recovery path.
//  - email-otp: used for ONE thing — "forgot password" by emailed 8-digit code, always for the admin
//    account and always to ADMIN_EMAIL, whatever email a client sends. Every other email-otp
//    endpoint is switched off, above all `/sign-in/email-otp`, which would let a mailbox alone sign
//    in, skipping both the password and the second factor.
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
  // Two-step verification is mandatory (ADR-023): it can't be switched off, and switching it on is
  // automatic at the first password sign-in.
  '/two-factor/enable',
  '/two-factor/disable',
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

/** The reset endpoints: both act on the admin account, whatever `email` the client sends. */
const PASSWORD_RESET_PATHS = new Set([CAPTCHA_PROTECTED_PATH, '/email-otp/reset-password']);

/**
 * Endpoints that answer a pending sign-in challenge. Without a session they are the second step of
 * signing in; with one they have no use left (there is no enable step to confirm), so they're
 * refused. Their `trustDevice` flag would also set a 30-day "skip 2FA on this browser" cookie.
 */
const SIGN_IN_CHALLENGE_PATHS = new Set([
  '/two-factor/send-otp',
  '/two-factor/verify-otp',
  '/two-factor/verify-backup-code',
]);

const SIGN_IN_PATH = '/sign-in/email';

// Per-request markers, keyed on the request's own context object — the same object the endpoint,
// its before-hooks and its after-hooks all receive (verified against better-auth 1.6.25, which is
// pinned; the flow tests fail if that ever stops holding). WeakSets, so a finished request's entry
// can't outlive it.
//  - failedCodeDeliveries: a code send failed. Both plugins swallow a rejected send (they only log
//    it), so a failed delivery would still answer 200 and leave the admin waiting for an email that
//    never comes. The after-hooks turn the marker into a 503.
//  - deliveredResetCodes: a reset code really went out. A reset request that ends without this
//    marker sent nothing — a failure, or no account under ADMIN_EMAIL — and answers 503 as well.
const failedCodeDeliveries = new WeakSet<object>();
const deliveredResetCodes = new WeakSet<object>();

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

/** Backup codes issued per account — the two-factor plugin's default, matched at enrolment. */
const BACKUP_CODE_COUNT = 10;

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

/**
 * two-factor `otpOptions.sendOTP`: the sign-in code. The user record the plugin passes is ignored —
 * the sender always mails ADMIN_EMAIL (ADR-023). A failure is marked for the 503 after-hook and
 * rethrown (the plugin catches and logs it).
 */
export function createTwoFactorOtpSender(sender: VerificationCodeSender) {
  return async ({ otp }: { otp: string }, ctx?: GenericEndpointContext): Promise<void> => {
    const result = await sender.send({ code: otp, purpose: 'sign-in' });
    if (!result.ok) {
      if (ctx) failedCodeDeliveries.add(ctx.context);
      throw result.error;
    }
  };
}

/**
 * email-otp `sendVerificationOTP`: sends ONLY the password-reset code, to ADMIN_EMAIL (the payload's
 * `email` is ignored). Any other type is dropped — those endpoints are disabled, so reaching here
 * with one means something bypassed that.
 *
 * Awaited, and the outcome is marked on the request so the after-hook can answer 503 when nothing
 * went out. (Until ADR-023 the send was fire-and-forget behind a uniform response, to hide which
 * address was the admin's. The recipient is now fixed, so there is no such secret left, and a
 * silently missing email was the bigger problem.)
 */
export function createPasswordResetOtpSender(sender: VerificationCodeSender) {
  return async ({ otp, type }: EmailOtpPayload, ctx?: GenericEndpointContext): Promise<void> => {
    if (type !== 'forget-password') return;
    const result = await sender.send({ code: otp, purpose: 'password-reset' });
    if (!ctx) return;
    if (result.ok) deliveredResetCodes.add(ctx.context);
    else failedCodeDeliveries.add(ctx.context);
  };
}

/** Ten `xxxxx-xxxxx` codes from [a-zA-Z0-9] — the two-factor plugin's own backup-code generator. */
function generateBackupCodeList(): string[] {
  return Array.from({ length: BACKUP_CODE_COUNT }, () => {
    const code = generateRandomString(10, 'a-z', '0-9', 'A-Z');
    return `${code.slice(0, 5)}-${code.slice(5)}`;
  });
}

/**
 * The stored form of a backup-code list with `storeBackupCodes: 'encrypted'`: the JSON array,
 * encrypted with the auth secret. Mirrors the two-factor plugin's (non-exported) `encodeBackupCodes`
 * in better-auth 1.6.25 — the flow tests prove the round trip through the plugin's own
 * `verify-backup-code` and `generate-backup-codes`.
 */
export async function encodeBackupCodes(
  codes: string[],
  key: GenericEndpointContext['context']['secretConfig'],
): Promise<string> {
  return symmetricEncrypt({ key, data: JSON.stringify(codes) });
}

type SignedInUser = { id: string; twoFactorEnabled?: boolean | null };

/**
 * Makes sure the account that just proved its password has two-step verification on: a
 * `two_factor` row (the sign-in challenge and backup codes need one) and the user flag (the
 * two-factor plugin only challenges when it is set). Written the way `/two-factor/enable` +
 * verification would, through Better Auth's adapters. Marks the in-flight session's user as enabled,
 * so the two-factor plugin's own after-hook — which runs next — turns this sign-in into a challenge.
 * Returns whether anything had to be written.
 */
async function ensureTwoFactorEnrolled(
  ctx: GenericEndpointContext,
  user: SignedInUser,
): Promise<boolean> {
  let changed = false;
  const row = await ctx.context.adapter.findOne({
    model: 'twoFactor',
    where: [{ field: 'userId', value: user.id }],
  });
  if (!row) {
    const key = ctx.context.secretConfig;
    try {
      await ctx.context.adapter.create({
        model: 'twoFactor',
        data: {
          // An unused TOTP seed, created exactly as `/two-factor/enable` does. `verified: false`
          // keeps TOTP from ever being offered against it (see ADR-022 on adding TOTP later).
          secret: await symmetricEncrypt({ key, data: generateRandomString(32) }),
          // Never shown to anyone: the admin replaces them from the Security page to get usable ones.
          backupCodes: await encodeBackupCodes(generateBackupCodeList(), key),
          userId: user.id,
          verified: false,
        },
      });
      changed = true;
    } catch (cause) {
      // `two_factor.user_id` is unique: a concurrent first sign-in may have inserted the row a
      // moment ago. If a row exists now, the account is enrolled — carry on to the challenge. Any
      // other failure leaves no row, and is rethrown (fail closed). Checked by re-reading rather
      // than by the driver's error code, so it holds on every adapter.
      const winner = await ctx.context.adapter.findOne({
        model: 'twoFactor',
        where: [{ field: 'userId', value: user.id }],
      });
      if (!winner) throw cause;
    }
  }
  if (user.twoFactorEnabled !== true) {
    await ctx.context.internalAdapter.updateUser(user.id, { twoFactorEnabled: true });
    changed = true;
  }
  user.twoFactorEnabled = true;
  return changed;
}

/**
 * Undoes the session a password sign-in just created, so a failure after the password can never
 * leave a password-only session behind. Best effort on each step — it runs on error paths — but the
 * cookie expiry always goes out.
 */
async function discardNewSession(ctx: GenericEndpointContext, token: string): Promise<void> {
  deleteSessionCookie(ctx, true);
  ctx.context.setNewSession(null);
  await ctx.context.internalAdapter.deleteSession(token).catch(() => {});
}

/** The two-factor plugin's "trust this browser" cookie and verification-row prefix (1.6.25). */
const TRUST_DEVICE_COOKIE = 'trust_device';
const TRUST_DEVICE_IDENTIFIER_PREFIX = 'trust-device-';

/**
 * Revokes every "trust this browser" record of `userId` and expires the cookie. The app never issues
 * one, but a valid one is the only way the two-factor plugin skips its challenge — and the plugin
 * rotates it on use, so the record named by the request cookie is already gone and a fresh one has
 * been written. Hence by user, not by the cookie's id.
 */
async function revokeTrustedDevices(ctx: GenericEndpointContext, userId: string): Promise<void> {
  expireCookie(ctx, ctx.context.createAuthCookie(TRUST_DEVICE_COOKIE));
  await ctx.context.adapter
    .deleteMany({
      model: 'verification',
      where: [
        { field: 'identifier', operator: 'starts_with', value: TRUST_DEVICE_IDENTIFIER_PREFIX },
        { field: 'value', value: userId },
      ],
    })
    .catch(() => {});
}

export type AdminAuthGuardDeps = {
  /**
   * Turnstile for the password-reset request. With a secret key, Better Auth's captcha plugin
   * verifies the token. Without one: if `required` (production) the request fails closed with 503;
   * otherwise (development, tests) the check is skipped, like the site's other Turnstile gate.
   */
  captcha: { secretKey: string | undefined; required: boolean };
  /** Rate limiter per {limit, window} — integrations' getRateLimiter in production. */
  rateLimiterFor: (options: { limit: number; windowSeconds: number }) => RateLimiter;
  /** Structured logger for the enrolment and delivery events. Never given a code or an address. */
  logger: Logger;
};

function bodyRecord(body: unknown): Record<string, unknown> {
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
}

/**
 * Project-specific guards around the stock plugins. No route handler involved — Better Auth's own.
 * MUST come before `twoFactor` in the plugin list: plugin after-hooks run in plugin order
 * (better-auth 1.6.25 `getHooks`), and the enrolment hook has to run before the two-factor plugin's
 * sign-in hook reads the user's flag.
 */
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
          // Codes only answer a sign-in challenge. From a signed-in session, the plugin would treat
          // a verified code as "confirm turning 2FA on" (and a backup code as a no-op that burns
          // one) — neither is a thing any more, so refuse rather than leave the path reachable.
          matcher: (ctx) => SIGN_IN_CHALLENGE_PATHS.has(ctx.path ?? ''),
          handler: createAuthMiddleware(async (ctx) => {
            if (await getSessionFromCtx(ctx)) {
              throw new APIError('BAD_REQUEST', { ...TWO_FACTOR_SIGN_IN_ONLY });
            }
          }),
        },
        {
          // No "trust this browser": a client-sent `trustDevice: true` is overwritten, so every
          // sign-in asks for a code.
          matcher: (ctx) => SIGN_IN_CHALLENGE_PATHS.has(ctx.path ?? ''),
          handler: createAuthMiddleware(async (ctx) => ({
            context: { body: { ...bodyRecord(ctx.body), trustDevice: false } },
          })),
        },
        {
          // The reset is always for the admin account: whatever `email` the client sent (none, an
          // empty string, another address) is replaced before the endpoint validates its body, so
          // the client doesn't need to know the address at all.
          matcher: (ctx) => PASSWORD_RESET_PATHS.has(ctx.path ?? ''),
          handler: createAuthMiddleware(async (ctx) => ({
            context: { body: { ...bodyRecord(ctx.body), email: ADMIN_EMAIL } },
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
          // Reset request: spend the site-wide budget. After Turnstile (the plugin's onRequest runs
          // before any hook), so it costs a tokenless bot nothing. The hour budget is checked first
          // and stops the day budget being spent on a request it already refuses. Every request
          // that gets here sends an email (the body can't fail validation — `email` is ours).
          matcher: (ctx) => ctx.path === CAPTCHA_PROTECTED_PATH,
          handler: createAuthMiddleware(async () => {
            for (const budget of RESET_REQUEST_GLOBAL_BUDGETS) {
              const limiter = deps.rateLimiterFor({
                limit: budget.limit,
                windowSeconds: budget.windowSeconds,
              });
              const { success, reset } = await limiter.limit(budget.key);
              if (!success) {
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
          // Mandatory 2FA: a correct password enrols an account that isn't enrolled yet, then the
          // two-factor plugin's own hook (next in line) swaps the session for a challenge. If the
          // enrolment fails, the session the password created is thrown away — fail closed.
          matcher: (ctx) => ctx.path === SIGN_IN_PATH,
          handler: createAuthMiddleware(async (ctx) => {
            const signedIn = ctx.context.newSession;
            if (!signedIn) return; // wrong password, or any other refused sign-in
            try {
              if (await ensureTwoFactorEnrolled(ctx, signedIn.user)) {
                deps.logger.info('two_factor_auto_enrolled');
              }
            } catch (cause) {
              await discardNewSession(ctx, signedIn.session.token);
              deps.logger.error('two_factor_enrolment_failed', {
                error: cause instanceof Error ? cause.message : String(cause),
              });
              throw new APIError('INTERNAL_SERVER_ERROR', { ...TWO_FACTOR_SETUP_FAILED });
            }
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
          // A reset request that answered success but sent nothing becomes a 503: either the send
          // failed (already logged by the sender), or there is no account under ADMIN_EMAIL — the
          // endpoint then skips the send silently, so that case is logged here.
          matcher: (ctx) => ctx.path === CAPTCHA_PROTECTED_PATH,
          handler: createAuthMiddleware(async (ctx) => {
            const delivered = deliveredResetCodes.has(ctx.context);
            const failed = failedCodeDeliveries.has(ctx.context);
            deliveredResetCodes.delete(ctx.context);
            failedCodeDeliveries.delete(ctx.context);
            if (delivered || isAPIError(ctx.context.returned)) return;
            if (!failed) {
              deps.logger.error('password_reset_account_missing', {
                reason: 'no user has the admin email — has the admin-email migration run?',
              });
            }
            throw new APIError('SERVICE_UNAVAILABLE', { ...EMAIL_DELIVERY_FAILED });
          }),
        },
      ],
    },
  };
}

/**
 * Backstop for mandatory 2FA, placed AFTER `twoFactor`: when a password sign-in is about to answer
 * with a live session — i.e. the two-factor plugin did not turn it into a challenge, for whatever
 * reason — the session is destroyed and the sign-in refused. Nothing lets a password alone in.
 */
export function signInChallengeBackstop(
  deps: Pick<AdminAuthGuardDeps, 'logger'>,
): BetterAuthPlugin {
  return {
    id: 'culprit-sign-in-challenge-backstop',
    hooks: {
      after: [
        {
          matcher: (ctx) => ctx.path === SIGN_IN_PATH,
          handler: createAuthMiddleware(async (ctx) => {
            const leaked = ctx.context.newSession;
            if (!leaked) return;
            // Always destroyed, even when the response is already an error: a live session must
            // never outlive a sign-in that wasn't challenged.
            await discardNewSession(ctx, leaked.session.token);
            await revokeTrustedDevices(ctx, leaked.user.id);
            deps.logger.error('sign_in_without_challenge_blocked');
            // An error response stays as it is; only a would-be success is turned into a 500.
            if (isAPIError(ctx.context.returned)) return;
            throw new APIError('INTERNAL_SERVER_ERROR', { ...TWO_FACTOR_SETUP_FAILED });
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
    // /sign-in/email, which is deliberately left out.
    endpoints: [CAPTCHA_PROTECTED_PATH],
  });
}

/** The full plugin set, in one place, so ./auth.ts and the tests configure Better Auth identically. */
export function adminAuthPlugins(
  deps: AdminAuthPluginDeps,
): [
  ReturnType<typeof adminAuthGuards>,
  ReturnType<typeof twoFactor>,
  ReturnType<typeof emailOTP>,
  BetterAuthPlugin,
  ReturnType<typeof signInChallengeBackstop>,
] {
  const otpHasher = createOtpHasher(deps.otpHashSecret);
  // An explicit tuple, not the inferred `(A | B | C)[]`: Better Auth infers the session's user
  // fields (e.g. `twoFactorEnabled`) per plugin, which a widened array loses.
  //
  // ORDER MATTERS. Plugin after-hooks run in this order: the guards' enrolment hook must run before
  // the two-factor plugin's sign-in hook, and the backstop after it.
  return [
    adminAuthGuards(deps),
    twoFactor({
      totpOptions: { disable: true },
      otpOptions: {
        digits: CODE_DIGITS,
        period: CODE_TTL_MINUTES, // minutes, in this plugin
        allowedAttempts: TWO_FACTOR_CODE_ATTEMPTS,
        storeOTP: otpHasher,
        sendOTP: createTwoFactorOtpSender(deps.codeSender),
      },
      // Encrypted with a key derived from BETTER_AUTH_SECRET (the plugin's symmetricEncrypt). The
      // enrolment hook writes the same format (encodeBackupCodes) — keep the two in step.
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
    resetCaptcha(deps),
    signInChallengeBackstop(deps),
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
      // Single admin only — no public registration. The credential is seeded, never a form.
      disableSignUp: true,
      ...PASSWORD_POLICY,
      // A completed reset signs out every existing session. The email-otp reset path checks this
      // same option. The admin then signs in again — through 2FA, as always.
      revokeSessionsOnPasswordReset: true,
    },
    disabledPaths: [...DISABLED_AUTH_PATHS],
    plugins: adminAuthPlugins(deps),
  } satisfies Partial<BetterAuthOptions>;
}
