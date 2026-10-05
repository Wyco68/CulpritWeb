// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { IntegrationError } from '@/modules/shared/lib/errors';
import { err, ok } from '@/modules/shared/lib/result';
import { createHash } from 'node:crypto';
import {
  InMemoryRateLimiter,
  type RateLimiter,
} from '@/modules/integrations/rate-limit/rate-limiter';
import { DISABLED_AUTH_PATHS, adminAuthSecurityOptions, createOtpHasher } from '../auth-security';
import type {
  SendVerificationCodeInput,
  VerificationCodeSender,
} from '../verification-code-sender';

// End-to-end through Better Auth's real HTTP handler, with the exact plugin set and options
// production uses (adminAuthSecurityOptions), over Better Auth's in-memory adapter — no database,
// no network. The email transport is a recording fake. This is what pins the contract the admin
// UI is built against: response shapes, error codes, cookies.

const BASE_URL = 'http://localhost:3000';
const ADMIN_EMAIL = 'admin@example.com';
const PASSWORD = 'correct horse battery';
const NEW_PASSWORD = 'a new long password';

type Db = Record<string, Record<string, unknown>[]>;

const OTP_HASH_SECRET = 'test-otp-hash-secret';
const RESET_FLOOR_MS = 400;

type SetupOptions = { captcha?: { secretKey: string | undefined; required: boolean } };

function setup(options: SetupOptions = {}) {
  const state = { emailConfigured: true, failSends: false, sendCostMs: 0 };
  const sent: SendVerificationCodeInput[] = [];
  const codeSender: VerificationCodeSender = {
    async send(input) {
      if (state.failSends) return err(new IntegrationError('Email delivery failed.'));
      clock.t += state.sendCostMs; // simulated provider latency, on the fake clock
      sent.push(input);
      return ok(undefined);
    },
  };
  const db: Db = { user: [], session: [], account: [], verification: [], twoFactor: [] };
  // Fresh limiters per harness, so budgets never leak between tests.
  const limiters = new Map<string, RateLimiter>();
  const rateLimiterFor = (opts: { limit: number; windowSeconds: number }) => {
    const id = `${opts.limit}:${opts.windowSeconds}`;
    if (!limiters.has(id)) limiters.set(id, new InMemoryRateLimiter(opts));
    return limiters.get(id)!;
  };
  // Fake clock for the reset response floor: `sleep` records and advances it instead of waiting.
  const clock = { t: 0 };
  const sleep = vi.fn(async (ms: number) => {
    clock.t += ms;
  });
  const auth = betterAuth({
    baseURL: BASE_URL,
    secret: 'test-secret-that-is-at-least-32-characters-long',
    database: memoryAdapter(db),
    advanced: { cookiePrefix: 'culprit' },
    logger: { disabled: true },
    ...adminAuthSecurityOptions({
      codeSender,
      isEmailDeliveryConfigured: () => state.emailConfigured,
      otpHashSecret: OTP_HASH_SECRET,
      captcha: options.captcha ?? { secretKey: undefined, required: false },
      rateLimiterFor,
      responseFloor: { ms: RESET_FLOOR_MS, now: () => clock.t, sleep },
    }),
  });

  /** A cookie-keeping client, like one browser tab. */
  function browser() {
    const jar = new Map<string, string>();
    return {
      jar,
      async post(
        path: string,
        body: Record<string, unknown> = {},
        extraHeaders: Record<string, string> = {},
        method: 'POST' | 'GET' = 'POST',
      ) {
        const response = await auth.handler(
          new Request(`${BASE_URL}/api/auth${path}`, {
            method,
            headers: {
              'content-type': 'application/json',
              origin: BASE_URL,
              cookie: [...jar].map(([name, value]) => `${name}=${value}`).join('; '),
              ...extraHeaders,
            },
            body: method === 'POST' ? JSON.stringify(body) : undefined,
          }),
        );
        const setCookies = response.headers.getSetCookie();
        for (const header of setCookies) {
          const [pair = ''] = header.split(';');
          const name = pair.slice(0, pair.indexOf('=')).trim();
          const value = pair.slice(pair.indexOf('=') + 1);
          if (!value || /max-age=0/i.test(header)) jar.delete(name);
          else jar.set(name, value);
        }
        const text = await response.text();
        let json: Record<string, unknown> | null = null;
        try {
          json = JSON.parse(text) as Record<string, unknown>;
        } catch {
          json = null;
        }
        return { status: response.status, json, text, setCookies, headers: response.headers };
      },
      has(cookie: string) {
        return jar.has(`culprit.${cookie}`);
      },
      /** Whether this tab's session cookie still names a live session on the server. */
      async isSignedIn() {
        const session = await auth.api.getSession({
          headers: new Headers({
            cookie: [...jar].map(([name, value]) => `${name}=${value}`).join('; '),
          }),
        });
        return session !== null;
      },
    };
  }

  async function seedAdmin() {
    const ctx = await auth.$context;
    const user = await ctx.internalAdapter.createUser({
      email: ADMIN_EMAIL,
      name: 'Admin',
      emailVerified: true,
    });
    await ctx.internalAdapter.createAccount({
      userId: user.id,
      providerId: 'credential',
      accountId: user.id,
      password: await ctx.password.hash(PASSWORD),
    });
    return user;
  }

  const lastCode = () => sent.at(-1)!.code;
  const adminRow = () => db.user!.find((row) => row.email === ADMIN_EMAIL)!;

  return { auth, db, state, sent, browser, seedAdmin, lastCode, adminRow, clock, sleep };
}

type Harness = ReturnType<typeof setup>;

async function signedInWithoutTwoFactor(h: Harness) {
  const tab = h.browser();
  const res = await tab.post('/sign-in/email', { email: ADMIN_EMAIL, password: PASSWORD });
  expect(res.status).toBe(200);
  expect(tab.has('session_token')).toBe(true);
  return tab;
}

/** Turns 2FA on the way the admin app does: password → emailed code → verify. */
async function enableTwoFactor(h: Harness) {
  const tab = await signedInWithoutTwoFactor(h);
  const enabled = await tab.post('/two-factor/enable', { password: PASSWORD });
  expect(enabled.status).toBe(200);
  expect((await tab.post('/two-factor/send-otp')).status).toBe(200);
  const verified = await tab.post('/two-factor/verify-otp', { code: h.lastCode() });
  expect(verified.status).toBe(200);
  return { tab, backupCodes: enabled.json!.backupCodes as string[] };
}

describe('admin auth flows (Better Auth + ADR-022 configuration)', () => {
  let h: Harness;

  beforeEach(async () => {
    h = setup();
    await h.seedAdmin();
  });

  describe('disabled endpoints', () => {
    it.each(DISABLED_AUTH_PATHS)('%s answers 404', async (path) => {
      const res = await h.browser().post(path, { email: ADMIN_EMAIL, otp: '12345678' });
      expect(res.status).toBe(404);
    });

    it('passwordless sign-in by emailed code is unreachable, even with a trailing slash', async () => {
      const res = await h.browser().post('/sign-in/email-otp/', {
        email: ADMIN_EMAIL,
        otp: '12345678',
      });
      expect(res.status).toBe(404);
    });

    it('is blocked by the endpoint hook too, not only by the router', async () => {
      await expect(
        h.auth.api.signInEmailOTP({ body: { email: ADMIN_EMAIL, otp: '12345678' } }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('turning two-step verification on', () => {
    it('is refused when email delivery is not configured', async () => {
      h.state.emailConfigured = false;
      const tab = await signedInWithoutTwoFactor(h);

      const res = await tab.post('/two-factor/enable', { password: PASSWORD });

      expect(res.status).toBe(400);
      expect(res.json).toMatchObject({ code: 'EMAIL_NOT_CONFIGURED' });
      expect(h.db.twoFactor).toHaveLength(0);
      expect(h.adminRow().twoFactorEnabled).not.toBe(true);
    });

    it('needs the password, returns backup codes without a TOTP secret, and stays off until a code is verified', async () => {
      const tab = await signedInWithoutTwoFactor(h);

      expect((await tab.post('/two-factor/enable', { password: 'wrong' })).status).toBe(400);

      const res = await tab.post('/two-factor/enable', { password: PASSWORD });
      expect(res.status).toBe(200);
      expect(res.json).not.toHaveProperty('totpURI');
      expect(res.json!.backupCodes).toHaveLength(10);
      expect(h.adminRow().twoFactorEnabled).not.toBe(true);

      expect(await tab.post('/two-factor/send-otp')).toMatchObject({
        status: 200,
        json: { status: true },
      });
      expect(h.sent.at(-1)).toMatchObject({ to: ADMIN_EMAIL, purpose: 'enable-two-factor' });
      expect(h.lastCode()).toMatch(/^\d{8}$/);

      const verified = await tab.post('/two-factor/verify-otp', { code: h.lastCode() });
      expect(verified.status).toBe(200);
      expect(h.adminRow().twoFactorEnabled).toBe(true);
      expect(tab.has('session_token')).toBe(true);
    });

    it('stores the code as a keyed HMAC — not as sent, not as a plain SHA-256', async () => {
      const tab = await signedInWithoutTwoFactor(h);
      await tab.post('/two-factor/enable', { password: PASSWORD });
      await tab.post('/two-factor/send-otp');
      const code = h.lastCode();

      const stored = JSON.stringify(h.db.verification);
      const unkeyed = createHash('sha256').update(code).digest('base64url');
      expect(stored).not.toContain(code);
      expect(stored).not.toContain(unkeyed);
      expect(stored).toContain(await createOtpHasher(OTP_HASH_SECRET).hash(code));
    });
  });

  describe('signing in with two-step verification on', () => {
    it('answers the password with a challenge instead of a session, then accepts the emailed code', async () => {
      await enableTwoFactor(h);
      const tab = h.browser();

      const signIn = await tab.post('/sign-in/email', { email: ADMIN_EMAIL, password: PASSWORD });
      expect(signIn.status).toBe(200);
      expect(signIn.json).toEqual({ twoFactorRedirect: true, twoFactorMethods: ['otp'] });
      expect(tab.has('session_token')).toBe(false);
      expect(tab.has('two_factor')).toBe(true);

      expect((await tab.post('/two-factor/send-otp')).status).toBe(200);
      expect(h.sent.at(-1)).toMatchObject({ purpose: 'sign-in' });

      const wrong = await tab.post('/two-factor/verify-otp', { code: '00000000' });
      expect(wrong.status).toBe(401);
      expect(wrong.json).toMatchObject({ code: 'INVALID_CODE' });

      const ok = await tab.post('/two-factor/verify-otp', { code: h.lastCode() });
      expect(ok.status).toBe(200);
      expect(ok.json).toHaveProperty('user.email', ADMIN_EMAIL);
      expect(tab.has('session_token')).toBe(true);
    });

    it('never sets a trust-this-browser cookie, even when asked to', async () => {
      await enableTwoFactor(h);
      const tab = h.browser();
      await tab.post('/sign-in/email', { email: ADMIN_EMAIL, password: PASSWORD });
      await tab.post('/two-factor/send-otp', { trustDevice: true });

      const res = await tab.post('/two-factor/verify-otp', {
        code: h.lastCode(),
        trustDevice: true,
      });

      expect(res.status).toBe(200);
      expect(tab.has('trust_device')).toBe(false);
      // …so the next sign-in is challenged again.
      const again = await tab.post('/sign-in/email', { email: ADMIN_EMAIL, password: PASSWORD });
      expect(again.json).toMatchObject({ twoFactorRedirect: true });
    });

    it('accepts a backup code once', async () => {
      const { backupCodes } = await enableTwoFactor(h);
      const tab = h.browser();
      await tab.post('/sign-in/email', { email: ADMIN_EMAIL, password: PASSWORD });

      const res = await tab.post('/two-factor/verify-backup-code', { code: backupCodes[0] });
      expect(res.status).toBe(200);
      expect(tab.has('session_token')).toBe(true);

      const replay = h.browser();
      await replay.post('/sign-in/email', { email: ADMIN_EMAIL, password: PASSWORD });
      const reused = await replay.post('/two-factor/verify-backup-code', { code: backupCodes[0] });
      expect(reused.status).toBe(401);
      expect(reused.json).toMatchObject({ code: 'INVALID_BACKUP_CODE' });
    });

    it('reports a failed email as 503 instead of pretending the code was sent', async () => {
      await enableTwoFactor(h);
      const tab = h.browser();
      await tab.post('/sign-in/email', { email: ADMIN_EMAIL, password: PASSWORD });
      h.state.failSends = true;

      const res = await tab.post('/two-factor/send-otp');

      expect(res.status).toBe(503);
      expect(res.json).toMatchObject({ code: 'EMAIL_DELIVERY_FAILED' });
    });

    it('rejects a code request without a pending challenge', async () => {
      const res = await h.browser().post('/two-factor/send-otp');
      expect(res.status).toBe(401);
      expect(res.json).toMatchObject({ code: 'INVALID_TWO_FACTOR_COOKIE' });
    });
  });

  describe('forgot password by emailed code', () => {
    it('answers the same for an unknown address and sends nothing', async () => {
      const unknown = await h
        .browser()
        .post('/email-otp/request-password-reset', { email: 'nobody@example.com' });
      const known = await h.browser().post('/email-otp/request-password-reset', {
        email: ADMIN_EMAIL,
      });

      expect(unknown.status).toBe(200);
      expect(unknown.json).toEqual({ success: true });
      expect(known.status).toBe(200);
      expect(known.json).toEqual(unknown.json);
      expect(h.sent).toHaveLength(1);
      expect(h.sent[0]).toMatchObject({ to: ADMIN_EMAIL, purpose: 'password-reset' });
      expect(h.sent[0]!.code).toMatch(/^\d{8}$/);
    });

    it('answers the same even when the email fails to send', async () => {
      h.state.failSends = true;
      const res = await h.browser().post('/email-otp/request-password-reset', {
        email: ADMIN_EMAIL,
      });
      expect(res.status).toBe(200);
      expect(res.json).toEqual({ success: true });
    });

    it('rejects a too-short password without spending the code, then resets and signs every session out', async () => {
      const existing = await signedInWithoutTwoFactor(h);
      const tab = h.browser();
      await tab.post('/email-otp/request-password-reset', { email: ADMIN_EMAIL });
      const code = h.lastCode();

      const wrong = await tab.post('/email-otp/reset-password', {
        email: ADMIN_EMAIL,
        otp: '00000000',
        password: NEW_PASSWORD,
      });
      expect(wrong.status).toBe(400);
      expect(wrong.json).toMatchObject({ code: 'INVALID_OTP' });

      const short = await tab.post('/email-otp/reset-password', {
        email: ADMIN_EMAIL,
        otp: code,
        password: 'short',
      });
      expect(short.status).toBe(400);
      expect(short.json).toMatchObject({ code: 'PASSWORD_TOO_SHORT' });

      const reset = await tab.post('/email-otp/reset-password', {
        email: ADMIN_EMAIL,
        otp: code,
        password: NEW_PASSWORD,
      });
      expect(reset.status).toBe(200);
      expect(reset.json).toEqual({ success: true });
      // Not signed in by the reset…
      expect(tab.has('session_token')).toBe(false);
      // …and every earlier session is gone.
      expect(h.db.session).toHaveLength(0);
      expect(existing.has('session_token')).toBe(true); // the cookie lingers, the session doesn't
      const session = await h.auth.api.getSession({
        headers: new Headers({
          cookie: [...existing.jar].map(([name, value]) => `${name}=${value}`).join('; '),
        }),
      });
      expect(session).toBeNull();

      const old = await h.browser().post('/sign-in/email', {
        email: ADMIN_EMAIL,
        password: PASSWORD,
      });
      expect(old.status).toBe(401);
      const fresh = await h.browser().post('/sign-in/email', {
        email: ADMIN_EMAIL,
        password: NEW_PASSWORD,
      });
      expect(fresh.status).toBe(200);
    });

    it('locks the code after three wrong guesses', async () => {
      const tab = h.browser();
      await tab.post('/email-otp/request-password-reset', { email: ADMIN_EMAIL });
      const code = h.lastCode();
      for (let i = 0; i < 3; i += 1) {
        await tab.post('/email-otp/reset-password', {
          email: ADMIN_EMAIL,
          otp: '00000000',
          password: NEW_PASSWORD,
        });
      }

      const res = await tab.post('/email-otp/reset-password', {
        email: ADMIN_EMAIL,
        otp: code,
        password: NEW_PASSWORD,
      });

      expect(res.status).toBe(403);
      expect(res.json).toMatchObject({ code: 'TOO_MANY_ATTEMPTS' });
    });

    it('still asks for the second factor after a reset when 2FA is on', async () => {
      await enableTwoFactor(h);
      const tab = h.browser();
      await tab.post('/email-otp/request-password-reset', { email: ADMIN_EMAIL });
      await tab.post('/email-otp/reset-password', {
        email: ADMIN_EMAIL,
        otp: h.lastCode(),
        password: NEW_PASSWORD,
      });

      const signIn = await tab.post('/sign-in/email', {
        email: ADMIN_EMAIL,
        password: NEW_PASSWORD,
      });

      expect(signIn.json).toMatchObject({ twoFactorRedirect: true });
      expect(tab.has('session_token')).toBe(false);
    });
  });
});

// Every endpoint Better Auth routes over HTTP with this configuration. A better-auth upgrade (it is
// pinned to an exact version) or a new plugin that adds an endpoint fails here, so the new surface
// is reviewed — and disabled, or added below on purpose — before it ships.
const EXPECTED_ROUTED_ENDPOINTS = [
  'GET /account-info',
  'GET /delete-user/callback',
  'GET /error',
  'GET /list-accounts',
  'GET /list-sessions',
  'GET /ok',
  'GET /reset-password/:token', // blocked (hook)
  'GET /verify-email',
  'GET,POST /callback/:id',
  'GET,POST /get-session',
  'POST /change-email',
  'POST /change-password',
  'POST /delete-user',
  'POST /email-otp/change-email', // disabled
  'POST /email-otp/check-verification-otp', // disabled
  'POST /email-otp/request-email-change', // disabled
  'POST /email-otp/request-password-reset',
  'POST /email-otp/reset-password',
  'POST /email-otp/send-verification-otp', // disabled
  'POST /email-otp/verify-email', // disabled
  'POST /forget-password/email-otp', // disabled
  'POST /get-access-token',
  'POST /link-social',
  'POST /refresh-token',
  'POST /request-password-reset', // disabled
  'POST /reset-password', // disabled
  'POST /revoke-other-sessions',
  'POST /revoke-session',
  'POST /revoke-sessions',
  'POST /send-verification-email',
  'POST /sign-in/email',
  'POST /sign-in/email-otp', // disabled
  'POST /sign-in/social',
  'POST /sign-out',
  'POST /sign-up/email', // refused by disableSignUp
  'POST /two-factor/disable',
  'POST /two-factor/enable',
  'POST /two-factor/generate-backup-codes',
  'POST /two-factor/get-totp-uri', // disabled
  'POST /two-factor/send-otp',
  'POST /two-factor/verify-backup-code',
  'POST /two-factor/verify-otp',
  'POST /two-factor/verify-totp', // disabled
  'POST /unlink-account',
  'POST /update-session',
  'POST /update-user',
  'POST /verify-password',
];

type RoutedEndpoint = {
  path?: string;
  options?: { method?: string | string[]; metadata?: { SERVER_ONLY?: boolean } };
};

describe('auth HTTP surface', () => {
  it('routes exactly the reviewed endpoints', () => {
    const { auth } = setup({ captcha: { secretKey: 'turnstile-secret', required: true } });
    const routed = Object.values(auth.api as unknown as Record<string, RoutedEndpoint>)
      // Same filter as better-call's router: no path or SERVER_ONLY → never routed.
      .filter((endpoint) => endpoint.path && !endpoint.options?.metadata?.SERVER_ONLY)
      .map((endpoint) => {
        const method = endpoint.options?.method;
        return `${[method].flat().join(',')} ${endpoint.path}`;
      })
      .sort();

    expect(routed).toEqual([...EXPECTED_ROUTED_ENDPOINTS].sort());
  });

  it('blocks the link-based reset callback, which disabledPaths cannot express', async () => {
    const h = setup();
    const res = await h.browser().post('/reset-password/some-token', {}, {}, 'GET');
    expect(res.status).toBe(404);
  });
});

describe('two-step verification hardening', () => {
  let h: Harness;

  beforeEach(async () => {
    h = setup();
    await h.seedAdmin();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('refuses the confirm-2FA code unless /two-factor/enable ran first (no lockout without backup codes)', async () => {
    const tab = await signedInWithoutTwoFactor(h);

    const send = await tab.post('/two-factor/send-otp');
    expect(send.status).toBe(400);
    expect(send.json).toMatchObject({ code: 'TWO_FACTOR_SETUP_REQUIRED' });

    const verify = await tab.post('/two-factor/verify-otp', { code: '12345678' });
    expect(verify.status).toBe(400);
    expect(verify.json).toMatchObject({ code: 'TWO_FACTOR_SETUP_REQUIRED' });

    expect(h.sent).toHaveLength(0);
    expect(h.adminRow().twoFactorEnabled).not.toBe(true);
  });

  it('refuses the confirm-2FA code when email stopped being configured after enable', async () => {
    const tab = await signedInWithoutTwoFactor(h);
    await tab.post('/two-factor/enable', { password: PASSWORD });
    h.state.emailConfigured = false;

    const send = await tab.post('/two-factor/send-otp');

    expect(send.status).toBe(400);
    expect(send.json).toMatchObject({ code: 'EMAIL_NOT_CONFIGURED' });
    expect(h.adminRow().twoFactorEnabled).not.toBe(true);
  });

  it('signs out every other session when 2FA is turned on, and keeps the one that did it', async () => {
    const other = await signedInWithoutTwoFactor(h);
    const { tab } = await enableTwoFactor(h);

    expect(await tab.isSignedIn()).toBe(true);
    expect(await other.isSignedIn()).toBe(false);
  });

  it('does not sign anyone out on an ordinary 2FA sign-in', async () => {
    const { tab: first } = await enableTwoFactor(h);
    const second = h.browser();
    await second.post('/sign-in/email', { email: ADMIN_EMAIL, password: PASSWORD });
    await second.post('/two-factor/send-otp');
    expect((await second.post('/two-factor/verify-otp', { code: h.lastCode() })).status).toBe(200);

    expect(await first.isSignedIn()).toBe(true);
    expect(await second.isSignedIn()).toBe(true);
  });

  it('signs out every other session when 2FA is turned off, and keeps the one that did it', async () => {
    const { tab } = await enableTwoFactor(h);
    const other = h.browser();
    await other.post('/sign-in/email', { email: ADMIN_EMAIL, password: PASSWORD });
    await other.post('/two-factor/send-otp');
    await other.post('/two-factor/verify-otp', { code: h.lastCode() });
    expect(await other.isSignedIn()).toBe(true);

    const res = await tab.post('/two-factor/disable', { password: PASSWORD });

    expect(res.status).toBe(200);
    expect(h.adminRow().twoFactorEnabled).toBe(false);
    expect(await tab.isSignedIn()).toBe(true);
    expect(await other.isSignedIn()).toBe(false);
  });

  it('does not sign anyone out when turning 2FA off fails', async () => {
    const { tab } = await enableTwoFactor(h);
    const other = h.browser();
    await other.post('/sign-in/email', { email: ADMIN_EMAIL, password: PASSWORD });
    await other.post('/two-factor/send-otp');
    await other.post('/two-factor/verify-otp', { code: h.lastCode() });

    const res = await tab.post('/two-factor/disable', { password: 'wrong password' });

    expect(res.status).toBe(400);
    expect(await other.isSignedIn()).toBe(true);
  });

  it('locks the account after 10 failed codes across challenges, and unlocks after 15 minutes', async () => {
    const start = new Date('2026-10-03T10:00:00Z');
    vi.useFakeTimers({ toFake: ['Date'], now: start });
    await enableTwoFactor(h);
    const tab = h.browser();
    await tab.post('/sign-in/email', { email: ADMIN_EMAIL, password: PASSWORD });

    // Time is frozen; a resend must be younger than the code it replaces (the plugin consumes the
    // newest row), so step the clock a second before each send.
    const tick = () => vi.setSystemTime(new Date(Date.now() + 1000));

    // Two codes × 5 wrong guesses each = 10 consecutive failures.
    for (let round = 0; round < 2; round += 1) {
      tick();
      await tab.post('/two-factor/send-otp');
      for (let i = 0; i < 5; i += 1) {
        const wrong = await tab.post('/two-factor/verify-otp', { code: '00000000' });
        expect(wrong.json).toMatchObject({ code: 'INVALID_CODE' });
      }
    }

    tick();
    await tab.post('/two-factor/send-otp');
    const locked = await tab.post('/two-factor/verify-otp', { code: h.lastCode() });
    expect(locked.status).toBe(429);
    expect(locked.json).toMatchObject({ code: 'ACCOUNT_TEMPORARILY_LOCKED' });
    expect(tab.has('session_token')).toBe(false);

    vi.setSystemTime(new Date(start.getTime() + 16 * 60 * 1000));
    const later = h.browser();
    await later.post('/sign-in/email', { email: ADMIN_EMAIL, password: PASSWORD });
    await later.post('/two-factor/send-otp');
    const unlocked = await later.post('/two-factor/verify-otp', { code: h.lastCode() });
    expect(unlocked.status).toBe(200);
    expect(h.db.twoFactor![0]).toMatchObject({ failedVerificationCount: 0, lockedUntil: null });
  });
});

describe('Turnstile on the password-reset request', () => {
  const siteverify = vi.fn(async (_url: unknown, init?: RequestInit) => {
    const { response, secret } = JSON.parse(String(init?.body)) as Record<string, string>;
    const success = secret === 'turnstile-secret' && response === 'good-token';
    return new Response(JSON.stringify({ success }), {
      headers: { 'content-type': 'application/json' },
    });
  });

  beforeEach(() => {
    siteverify.mockClear();
    vi.stubGlobal('fetch', siteverify);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function withCaptcha(captcha: { secretKey: string | undefined; required: boolean }) {
    const h = setup({ captcha });
    await h.seedAdmin();
    return h;
  }

  it('reads the token from the x-captcha-response header and verifies it server-side', async () => {
    const h = await withCaptcha({ secretKey: 'turnstile-secret', required: true });

    const missing = await h
      .browser()
      .post('/email-otp/request-password-reset', { email: ADMIN_EMAIL });
    expect(missing.status).toBe(400);
    expect(missing.json).toMatchObject({ code: 'MISSING_RESPONSE' });

    const bad = await h
      .browser()
      .post(
        '/email-otp/request-password-reset',
        { email: ADMIN_EMAIL },
        { 'x-captcha-response': 'bad-token' },
      );
    expect(bad.status).toBe(403);
    expect(bad.json).toMatchObject({ code: 'VERIFICATION_FAILED' });
    expect(h.sent).toHaveLength(0);

    const good = await h
      .browser()
      .post(
        '/email-otp/request-password-reset',
        { email: ADMIN_EMAIL },
        { 'x-captcha-response': 'good-token' },
      );
    expect(good.status).toBe(200);
    expect(good.json).toEqual({ success: true });
    await vi.waitFor(() => expect(h.sent).toHaveLength(1));
    expect(String(siteverify.mock.calls[0]![0])).toBe(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    );
  });

  it('does not put sign-in or the reset itself behind the captcha', async () => {
    const h = await withCaptcha({ secretKey: 'turnstile-secret', required: true });

    const signIn = await h
      .browser()
      .post('/sign-in/email', { email: ADMIN_EMAIL, password: PASSWORD });
    const reset = await h.browser().post('/email-otp/reset-password', {
      email: ADMIN_EMAIL,
      otp: '00000000',
      password: NEW_PASSWORD,
    });

    expect(signIn.status).toBe(200);
    expect(reset.json).toMatchObject({ code: 'INVALID_OTP' });
    expect(siteverify).not.toHaveBeenCalled();
  });

  it('fails closed in production when no Turnstile secret is configured', async () => {
    const h = await withCaptcha({ secretKey: undefined, required: true });

    const res = await h.browser().post('/email-otp/request-password-reset', { email: ADMIN_EMAIL });

    expect(res.status).toBe(503);
    expect(res.json).toMatchObject({ code: 'CAPTCHA_NOT_CONFIGURED' });
    expect(h.sent).toHaveLength(0);
  });
});

describe('site-wide reset budget (charged only after Turnstile)', () => {
  const siteverify = vi.fn(async (_url: unknown, init?: RequestInit) => {
    const { response } = JSON.parse(String(init?.body)) as Record<string, string>;
    return new Response(JSON.stringify({ success: response === 'good-token' }), {
      headers: { 'content-type': 'application/json' },
    });
  });

  beforeEach(() => {
    vi.stubGlobal('fetch', siteverify);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  async function harness() {
    const h = setup({ captcha: { secretKey: 'turnstile-secret', required: true } });
    await h.seedAdmin();
    return h;
  }

  const request = (h: Harness, token?: string) =>
    h
      .browser()
      .post(
        '/email-otp/request-password-reset',
        { email: ADMIN_EMAIL },
        token ? { 'x-captcha-response': token } : {},
      );

  it('is not spent by requests that fail Turnstile', async () => {
    const h = await harness();
    for (let i = 0; i < 12; i += 1) {
      expect((await request(h)).json).toMatchObject({ code: 'MISSING_RESPONSE' });
      expect((await request(h, 'bad-token')).json).toMatchObject({ code: 'VERIFICATION_FAILED' });
    }

    // The whole hourly budget is still there.
    for (let i = 0; i < 5; i += 1) expect((await request(h, 'good-token')).status).toBe(200);
  });

  it('is not spent by requests whose body fails validation', async () => {
    const h = await harness();
    for (let i = 0; i < 6; i += 1) {
      const res = await h
        .browser()
        .post('/email-otp/request-password-reset', {}, { 'x-captcha-response': 'good-token' });
      expect(res.status).toBe(400);
    }

    for (let i = 0; i < 5; i += 1) expect((await request(h, 'good-token')).status).toBe(200);
  });

  it('is spent by requests that pass Turnstile: 5 an hour, then 429 with Retry-After', async () => {
    const h = await harness();
    for (let i = 0; i < 5; i += 1) expect((await request(h, 'good-token')).status).toBe(200);

    const refused = await request(h, 'good-token');

    expect(refused.status).toBe(429);
    expect(refused.json).toMatchObject({ code: 'RESET_BUDGET_EXHAUSTED' });
    expect(Number(refused.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(h.sent).toHaveLength(5);
  });

  it('caps at 10 a day even when the hourly budget has refilled', async () => {
    const start = new Date('2026-10-03T00:00:00Z').getTime();
    vi.useFakeTimers({ toFake: ['Date'], now: start });
    const h = await harness();

    for (let hour = 0; hour < 2; hour += 1) {
      vi.setSystemTime(start + hour * 61 * 60 * 1000);
      for (let i = 0; i < 5; i += 1) expect((await request(h, 'good-token')).status).toBe(200);
    }
    vi.setSystemTime(start + 3 * 61 * 60 * 1000);

    const refused = await request(h, 'good-token');
    expect(refused.status).toBe(429);
    expect(refused.json).toMatchObject({ code: 'RESET_BUDGET_EXHAUSTED' });
    expect(h.sent).toHaveLength(10);
  });
});

describe('reset-request response floor', () => {
  let h: Harness;

  beforeEach(async () => {
    h = setup();
    await h.seedAdmin();
  });

  async function timed(email: string) {
    const before = h.clock.t;
    const res = await h.browser().post('/email-otp/request-password-reset', { email });
    return { res, elapsed: h.clock.t - before };
  }

  it('pads a real and an unknown address to the same floor', async () => {
    const known = await timed(ADMIN_EMAIL);
    const unknown = await timed('nobody@example.com');

    expect(known.res.json).toEqual({ success: true });
    expect(unknown.res.json).toEqual({ success: true });
    expect(known.elapsed).toBe(RESET_FLOOR_MS);
    expect(unknown.elapsed).toBe(RESET_FLOOR_MS);
  });

  it('only sleeps the remainder when the request itself took time', async () => {
    h.state.sendCostMs = 150;

    const known = await timed(ADMIN_EMAIL);

    expect(h.sleep).toHaveBeenLastCalledWith(RESET_FLOOR_MS - 150);
    expect(known.elapsed).toBe(RESET_FLOOR_MS);
  });

  it('does not pad other endpoints', async () => {
    await h.browser().post('/sign-in/email', { email: ADMIN_EMAIL, password: PASSWORD });
    expect(h.sleep).not.toHaveBeenCalled();
  });
});
