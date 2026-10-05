// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { betterAuth, type BetterAuthPlugin } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { createHash, createHmac } from 'node:crypto';
import type { EmailClient, SendEmailInput } from '@/modules/integrations';
import { IntegrationError } from '@/modules/shared/lib/errors';
import type { Logger } from '@/modules/shared/lib/logger';
import { err, ok } from '@/modules/shared/lib/result';
import {
  InMemoryRateLimiter,
  type RateLimiter,
} from '@/modules/integrations/rate-limit/rate-limiter';
import { ADMIN_EMAIL } from '../auth-policy';
import { DISABLED_AUTH_PATHS, adminAuthSecurityOptions, createOtpHasher } from '../auth-security';
import { createVerificationCodeSender } from '../verification-code-sender';
import type { VerificationCodePurpose } from '../emails/verification-code-email';

// End-to-end through Better Auth's real HTTP handler, with the exact plugin set and options
// production uses (adminAuthSecurityOptions), over Better Auth's in-memory adapter — no database,
// no network. The code sender is the real one; only its email transport is a recording fake, so
// these tests see the actual recipient of every email. This is what pins the contract the admin UI
// is built against: response shapes, error codes, cookies.

const BASE_URL = 'http://localhost:3000';
const SECRET = 'test-secret-that-is-at-least-32-characters-long';
const PASSWORD = 'correct horse battery';
const NEW_PASSWORD = 'a new long password';
const BACKUP_CODE_PATTERN = /^[A-Za-z0-9]{5}-[A-Za-z0-9]{5}$/;

type Db = Record<string, Record<string, unknown>[]>;
type SentCode = { to: string; code: string; purpose: VerificationCodePurpose };

const OTP_HASH_SECRET = 'test-otp-hash-secret';

type SetupOptions = {
  captcha?: { secretKey: string | undefined; required: boolean };
  /** Spliced in just before the backstop (the last plugin) — for probing the backstop only. */
  pluginBeforeBackstop?: BetterAuthPlugin;
};

function setup(options: SetupOptions = {}) {
  const state = { failSends: false };
  const sent: SentCode[] = [];
  const emailClient: EmailClient = {
    async send(message: SendEmailInput) {
      if (state.failSends) return err(new IntegrationError('Email delivery failed.'));
      const props = message.react.props as { code: string; purpose: VerificationCodePurpose };
      sent.push({ to: message.to, code: props.code, purpose: props.purpose });
      return ok({ id: `email-${sent.length}` });
    },
  };
  const logger: Logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const codeSender = createVerificationCodeSender({
    emailClient,
    emailDeliveryConfigured: true,
    logCodesWhenUnconfigured: false,
    expiresInMinutes: 5,
    logger,
  });
  const db: Db = { user: [], session: [], account: [], verification: [], twoFactor: [] };
  // Fresh limiters per harness, so budgets never leak between tests.
  const limiters = new Map<string, RateLimiter>();
  const rateLimiterFor = (opts: { limit: number; windowSeconds: number }) => {
    const id = `${opts.limit}:${opts.windowSeconds}`;
    if (!limiters.has(id)) limiters.set(id, new InMemoryRateLimiter(opts));
    return limiters.get(id)!;
  };
  const security = adminAuthSecurityOptions({
    codeSender,
    logger,
    otpHashSecret: OTP_HASH_SECRET,
    captcha: options.captcha ?? { secretKey: undefined, required: false },
    rateLimiterFor,
  });
  const auth = betterAuth({
    baseURL: BASE_URL,
    secret: SECRET,
    database: memoryAdapter(db),
    advanced: { cookiePrefix: 'culprit' },
    logger: { disabled: true },
    ...security,
    ...(options.pluginBeforeBackstop
      ? {
          plugins: [
            ...security.plugins.slice(0, -1),
            options.pluginBeforeBackstop,
            ...security.plugins.slice(-1),
          ],
        }
      : {}),
  });

  /** A cookie-keeping client, like one browser tab. */
  function browser() {
    const jar = new Map<string, string>();
    const cookieHeader = () => [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
    return {
      jar,
      /** `body: null` sends a POST with no body at all. */
      async post(
        path: string,
        body: Record<string, unknown> | null = {},
        extraHeaders: Record<string, string> = {},
        method: 'POST' | 'GET' = 'POST',
      ) {
        const response = await auth.handler(
          new Request(`${BASE_URL}/api/auth${path}`, {
            method,
            headers: {
              'content-type': 'application/json',
              origin: BASE_URL,
              cookie: cookieHeader(),
              ...extraHeaders,
            },
            body: method === 'POST' && body !== null ? JSON.stringify(body) : undefined,
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
          headers: new Headers({ cookie: cookieHeader() }),
        });
        return session !== null;
      },
    };
  }

  /** The admin as provisioned: a user row and a credential account, 2FA not yet enrolled. */
  async function seedAdmin(email: string = ADMIN_EMAIL) {
    const ctx = await auth.$context;
    const user = await ctx.internalAdapter.createUser({
      email,
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
  const adminRow = () => db.user![0]!;

  return { auth, db, state, sent, logger, browser, seedAdmin, lastCode, adminRow };
}

type Harness = ReturnType<typeof setup>;
type Tab = ReturnType<Harness['browser']>;

/** The password step: must answer with a challenge, never a session. */
async function passwordStep(h: Harness, tab: Tab = h.browser(), email: string = ADMIN_EMAIL) {
  const res = await tab.post('/sign-in/email', { email, password: PASSWORD });
  expect(res.status).toBe(200);
  expect(res.json).toEqual({ twoFactorRedirect: true, twoFactorMethods: ['otp'] });
  expect(tab.has('session_token')).toBe(false);
  return tab;
}

/** A full sign-in the way the admin app does it: password → emailed code → verify. */
async function signedIn(h: Harness, tab: Tab = h.browser()) {
  await passwordStep(h, tab);
  expect((await tab.post('/two-factor/send-otp')).status).toBe(200);
  const verified = await tab.post('/two-factor/verify-otp', { code: h.lastCode() });
  expect(verified.status).toBe(200);
  expect(tab.has('session_token')).toBe(true);
  return tab;
}

/** Verification rows that would let a browser skip the challenge ("trust this browser"). */
function trustRecords(h: Harness) {
  return h.db.verification!.filter((row) => String(row.identifier).startsWith('trust-device-'));
}

/**
 * A browser holding a valid "trust this browser" cookie — the only stock way past the two-factor
 * plugin's challenge. This app never issues one (trustDevice is forced off), so it's forged here,
 * signed the way better-call signs cookies, to reach the backstop.
 */
async function withForgedTrustCookie(h: Harness) {
  const ctx = await h.auth.$context;
  const userId = String(h.adminRow().id);
  const trustId = 'trust-device-forged-for-test';
  await ctx.internalAdapter.createVerificationValue({
    identifier: trustId,
    value: userId,
    expiresAt: new Date(Date.now() + 60_000),
  });
  const token = createHmac('sha256', SECRET).update(`${userId}!${trustId}`).digest('base64url');
  const value = `${token}!${trustId}`;
  const signature = createHmac('sha256', SECRET).update(value).digest('base64');
  const tab = h.browser();
  tab.jar.set('culprit.trust_device', encodeURIComponent(`${value}.${signature}`));
  return tab;
}

describe('admin auth flows (Better Auth + ADR-022/ADR-023 configuration)', () => {
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

    it('turning 2FA on or off answers 404 even from a signed-in session with the password', async () => {
      const tab = await signedIn(h);

      expect((await tab.post('/two-factor/enable', { password: PASSWORD })).status).toBe(404);
      expect((await tab.post('/two-factor/disable', { password: PASSWORD })).status).toBe(404);
      expect(h.adminRow().twoFactorEnabled).toBe(true);
      expect(h.db.twoFactor).toHaveLength(1);
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
      await expect(
        h.auth.api.disableTwoFactor({ body: { password: PASSWORD }, headers: new Headers() }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('two-step verification is mandatory', () => {
    it('enrols the account at its first password sign-in and answers with a challenge, not a session', async () => {
      expect(h.adminRow().twoFactorEnabled).not.toBe(true);
      expect(h.db.twoFactor).toHaveLength(0);
      const tab = h.browser();

      const res = await tab.post('/sign-in/email', { email: ADMIN_EMAIL, password: PASSWORD });

      expect(res.status).toBe(200);
      expect(res.json).toEqual({ twoFactorRedirect: true, twoFactorMethods: ['otp'] });
      expect(tab.has('session_token')).toBe(false);
      expect(tab.has('two_factor')).toBe(true);
      expect(h.db.session).toHaveLength(0);
      expect(h.adminRow().twoFactorEnabled).toBe(true);
      expect(h.db.twoFactor).toHaveLength(1);
      // An unused TOTP seed, encrypted — never offered (TOTP is off, and the row is unverified).
      expect(h.db.twoFactor![0]).toMatchObject({ userId: h.adminRow().id, verified: false });
      expect(String(h.db.twoFactor![0]!.secret)).not.toHaveLength(32);
      // The sign-in itself sends nothing; the client asks for the code.
      expect(h.sent).toHaveLength(0);
      expect(h.logger.info).toHaveBeenCalledWith('two_factor_auto_enrolled');
    });

    it('emails the code to the admin mailbox, and the right code signs in', async () => {
      const tab = await passwordStep(h);

      expect(await tab.post('/two-factor/send-otp')).toMatchObject({
        status: 200,
        json: { status: true },
      });
      expect(h.sent).toEqual([
        { to: 'culpritteam@gmail.com', code: expect.stringMatching(/^\d{8}$/), purpose: 'sign-in' },
      ]);

      const wrong = await tab.post('/two-factor/verify-otp', { code: '00000000' });
      expect(wrong.status).toBe(401);
      expect(wrong.json).toMatchObject({ code: 'INVALID_CODE' });

      const ok = await tab.post('/two-factor/verify-otp', { code: h.lastCode() });
      expect(ok.status).toBe(200);
      expect(ok.json).toHaveProperty('user.email', ADMIN_EMAIL);
      expect(ok.json).toHaveProperty('user.twoFactorEnabled', true);
      expect(tab.has('session_token')).toBe(true);
      expect(await tab.isSignedIn()).toBe(true);
    });

    it('sends the code to culpritteam@gmail.com even when the user row has another address', async () => {
      const other = setup();
      await other.seedAdmin('old-test-address@example.com');
      const tab = await passwordStep(other, other.browser(), 'old-test-address@example.com');

      await tab.post('/two-factor/send-otp');

      expect(other.sent).toHaveLength(1);
      expect(other.sent[0]!.to).toBe('culpritteam@gmail.com');
      const ok = await tab.post('/two-factor/verify-otp', { code: other.lastCode() });
      expect(ok.status).toBe(200);
    });

    it('does not re-enrol on later sign-ins, and still challenges every one', async () => {
      await signedIn(h);
      const row = { ...h.db.twoFactor![0]! };

      await passwordStep(h);

      expect(h.db.twoFactor).toEqual([expect.objectContaining({ id: row.id })]);
      expect(h.db.twoFactor![0]!.backupCodes).toBe(row.backupCodes);
      expect(h.logger.info).toHaveBeenCalledTimes(1);
    });

    it('repairs a flag-on account whose two_factor row is missing, instead of locking it out', async () => {
      await signedIn(h);
      h.db.twoFactor!.length = 0; // e.g. removed by hand

      const tab = await passwordStep(h);
      await tab.post('/two-factor/send-otp');
      const ok = await tab.post('/two-factor/verify-otp', { code: h.lastCode() });

      expect(ok.status).toBe(200);
      expect(h.db.twoFactor).toHaveLength(1);
    });

    it('refuses a wrong password without enrolling anything', async () => {
      const tab = h.browser();

      const res = await tab.post('/sign-in/email', { email: ADMIN_EMAIL, password: 'wrong pass' });

      expect(res.status).toBe(401);
      expect(res.json).toMatchObject({ code: 'INVALID_EMAIL_OR_PASSWORD' });
      expect(h.adminRow().twoFactorEnabled).not.toBe(true);
      expect(h.db.twoFactor).toHaveLength(0);
      expect(tab.has('two_factor')).toBe(false);
    });

    it('never sets a trust-this-browser cookie, even when asked to', async () => {
      const tab = await passwordStep(h);
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

    it('reports a failed email as 503 instead of pretending the code was sent', async () => {
      const tab = await passwordStep(h);
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

    it.each(['/two-factor/send-otp', '/two-factor/verify-otp', '/two-factor/verify-backup-code'])(
      'refuses %s from a signed-in session (codes only answer a sign-in challenge)',
      async (path) => {
        const tab = await signedIn(h);
        const sentBefore = h.sent.length;

        const res = await tab.post(path, { code: '12345678' });

        expect(res.status).toBe(400);
        expect(res.json).toMatchObject({ code: 'TWO_FACTOR_SIGN_IN_ONLY' });
        expect(h.sent).toHaveLength(sentBefore);
        expect(await tab.isSignedIn()).toBe(true);
      },
    );

    it('stores the code as a keyed HMAC — not as sent, not as a plain SHA-256', async () => {
      const tab = await passwordStep(h);
      await tab.post('/two-factor/send-otp');
      const code = h.lastCode();

      const stored = JSON.stringify(h.db.verification);
      const unkeyed = createHash('sha256').update(code).digest('base64url');
      expect(stored).not.toContain(code);
      expect(stored).not.toContain(unkeyed);
      expect(stored).toContain(await createOtpHasher(OTP_HASH_SECRET).hash(code));
    });
  });

  describe('failing closed', () => {
    it('signs nobody in when enrolment fails after a correct password', async () => {
      const ctx = await h.auth.$context;
      const updateUser = vi
        .spyOn(ctx.internalAdapter, 'updateUser')
        .mockRejectedValue(new Error('database unavailable'));
      const tab = h.browser();

      const res = await tab.post('/sign-in/email', { email: ADMIN_EMAIL, password: PASSWORD });
      updateUser.mockRestore();

      expect(res.status).toBe(500);
      expect(res.json).toMatchObject({ code: 'TWO_FACTOR_SETUP_FAILED' });
      expect(res.text).not.toContain('database unavailable');
      expect(tab.has('session_token')).toBe(false);
      expect(h.db.session).toHaveLength(0);
      expect(await tab.isSignedIn()).toBe(false);
      expect(h.logger.error).toHaveBeenCalledWith('two_factor_enrolment_failed', {
        error: 'database unavailable',
      });
    });

    it('destroys the session and every trusted-browser record if the two-factor plugin ever lets a password sign-in through', async () => {
      await signedIn(h);
      const tab = await withForgedTrustCookie(h);
      const sessionsBefore = h.db.session!.length;

      const res = await tab.post('/sign-in/email', { email: ADMIN_EMAIL, password: PASSWORD });

      expect(res.status).toBe(500);
      expect(res.json).toMatchObject({ code: 'TWO_FACTOR_SETUP_FAILED' });
      expect(tab.has('session_token')).toBe(false);
      expect(h.db.session).toHaveLength(sessionsBefore);
      expect(await tab.isSignedIn()).toBe(false);
      // The plugin rotated the trust record on use; the backstop removes the new one too.
      expect(tab.has('trust_device')).toBe(false);
      expect(trustRecords(h)).toHaveLength(0);
      expect(h.logger.error).toHaveBeenCalledWith('sign_in_without_challenge_blocked');
    });

    it('still destroys the leaked session when the response is already an error', async () => {
      // A plugin between twoFactor and the backstop turns the (unchallenged) success into an error
      // without clearing the session — the backstop must clean up and leave that error as it is.
      const armed = { on: false };
      const teapot: BetterAuthPlugin = {
        id: 'test-error-after-sign-in',
        hooks: {
          after: [
            {
              matcher: (ctx) => armed.on && ctx.path === '/sign-in/email',
              handler: createAuthMiddleware(async () => {
                throw new APIError('BAD_REQUEST', { code: 'TEST_ERROR', message: 'test' });
              }),
            },
          ],
        },
      };
      const probe = setup({ pluginBeforeBackstop: teapot });
      await probe.seedAdmin();
      await signedIn(probe);
      const tab = await withForgedTrustCookie(probe);
      const sessionsBefore = probe.db.session!.length;
      armed.on = true;

      const res = await tab.post('/sign-in/email', { email: ADMIN_EMAIL, password: PASSWORD });

      expect(res.status).toBe(400);
      expect(res.json).toMatchObject({ code: 'TEST_ERROR' });
      expect(tab.has('session_token')).toBe(false);
      expect(probe.db.session).toHaveLength(sessionsBefore);
      expect(trustRecords(probe)).toHaveLength(0);
    });
  });

  describe('concurrent first sign-ins', () => {
    /**
     * Emulates the `two_factor.user_id` unique index (the memory adapter has none): a second insert
     * for the same user is rejected the way Postgres would reject it.
     */
    async function enforceUniqueTwoFactorUser(harness: Harness) {
      const ctx = await harness.auth.$context;
      const create = ctx.adapter.create.bind(ctx.adapter);
      return vi.spyOn(ctx.adapter, 'create').mockImplementation(async (input) => {
        const data = input.data as { userId?: unknown };
        if (
          input.model === 'twoFactor' &&
          harness.db.twoFactor!.some((row) => row.userId === data.userId)
        ) {
          throw new Error(
            'duplicate key value violates unique constraint "two_factor_user_id_key"',
          );
        }
        return create(input as Parameters<typeof create>[0]);
      });
    }

    it('enrol once and all get a challenge — the losers re-read the winning row', async () => {
      const spy = await enforceUniqueTwoFactorUser(h);
      // Hold every request at its "is there a row?" check until all three have made it, so all
      // three see none and race to insert — the interleaving a real database allows.
      const ctx = await h.auth.$context;
      const findOne = ctx.adapter.findOne.bind(ctx.adapter);
      let arrived = 0;
      let release: () => void = () => {};
      const allArrived = new Promise<void>((resolve) => {
        release = resolve;
      });
      const barrier = vi.spyOn(ctx.adapter, 'findOne').mockImplementation(async (input) => {
        if (input.model === 'twoFactor' && arrived < 3) {
          arrived += 1;
          if (arrived === 3) release();
          await allArrived;
        }
        return findOne(input as Parameters<typeof findOne>[0]);
      });
      const tabs = [h.browser(), h.browser(), h.browser()];

      const results = await Promise.all(
        tabs.map((tab) => tab.post('/sign-in/email', { email: ADMIN_EMAIL, password: PASSWORD })),
      );

      // Every request raced past the "no row yet" check, so the conflict branch really ran.
      expect(spy.mock.calls.filter(([input]) => input.model === 'twoFactor')).toHaveLength(3);
      spy.mockRestore();
      barrier.mockRestore();
      for (const res of results) {
        expect(res.status).toBe(200);
        expect(res.json).toEqual({ twoFactorRedirect: true, twoFactorMethods: ['otp'] });
      }
      expect(h.db.twoFactor).toHaveLength(1);
      expect(h.db.session).toHaveLength(0);
      // Each challenge completes against the one row.
      await tabs[2]!.post('/two-factor/send-otp');
      expect((await tabs[2]!.post('/two-factor/verify-otp', { code: h.lastCode() })).status).toBe(
        200,
      );
    });

    it('still fails closed when the insert fails and no row exists', async () => {
      const ctx = await h.auth.$context;
      const original = ctx.adapter.create.bind(ctx.adapter);
      const create = vi.spyOn(ctx.adapter, 'create').mockImplementation(async (input) => {
        if (input.model === 'twoFactor') throw new Error('connection reset');
        return original(input as Parameters<typeof original>[0]);
      });
      const tab = h.browser();

      const res = await tab.post('/sign-in/email', { email: ADMIN_EMAIL, password: PASSWORD });
      create.mockRestore();

      expect(res.status).toBe(500);
      expect(res.json).toMatchObject({ code: 'TWO_FACTOR_SETUP_FAILED' });
      expect(h.db.twoFactor).toHaveLength(0);
      expect(h.db.session).toHaveLength(0);
      expect(await tab.isSignedIn()).toBe(false);
    });
  });

  describe('backup codes', () => {
    it('the codes written at enrolment are in the plugin format and work at sign-in', async () => {
      await passwordStep(h);
      const { backupCodes } = await h.auth.api.viewBackupCodes({
        body: { userId: String(h.adminRow().id) },
      });
      expect(backupCodes).toHaveLength(10);
      for (const code of backupCodes) expect(code).toMatch(BACKUP_CODE_PATTERN);

      const tab = await passwordStep(h);
      const res = await tab.post('/two-factor/verify-backup-code', { code: backupCodes[0] });

      expect(res.status).toBe(200);
      expect(tab.has('session_token')).toBe(true);
    });

    it('are replaced from a signed-in session with the password, then work once at sign-in', async () => {
      const settings = await signedIn(h);

      expect(
        (await settings.post('/two-factor/generate-backup-codes', { password: 'wrong' })).status,
      ).toBe(400);
      const generated = await settings.post('/two-factor/generate-backup-codes', {
        password: PASSWORD,
      });
      expect(generated.status).toBe(200);
      expect(generated.json).toMatchObject({ status: true });
      const backupCodes = generated.json!.backupCodes as string[];
      expect(backupCodes).toHaveLength(10);
      for (const code of backupCodes) expect(code).toMatch(BACKUP_CODE_PATTERN);

      const tab = await passwordStep(h);
      const res = await tab.post('/two-factor/verify-backup-code', { code: backupCodes[0] });
      expect(res.status).toBe(200);
      expect(tab.has('session_token')).toBe(true);

      const replay = await passwordStep(h);
      const reused = await replay.post('/two-factor/verify-backup-code', { code: backupCodes[0] });
      expect(reused.status).toBe(401);
      expect(reused.json).toMatchObject({ code: 'INVALID_BACKUP_CODE' });
    });

    it('cannot be generated without a session', async () => {
      const res = await h
        .browser()
        .post('/two-factor/generate-backup-codes', { password: PASSWORD });
      expect(res.status).toBe(401);
    });
  });

  describe('forgot password by emailed code', () => {
    it.each([
      ['no email field', {}],
      ['an empty email', { email: '' }],
      ['another address', { email: 'someone-else@example.com' }],
    ])('sends the code to the admin mailbox given %s', async (_label, body) => {
      const res = await h.browser().post('/email-otp/request-password-reset', body);

      expect(res.status).toBe(200);
      expect(res.json).toEqual({ success: true });
      expect(h.sent).toEqual([
        {
          to: 'culpritteam@gmail.com',
          code: expect.stringMatching(/^\d{8}$/),
          purpose: 'password-reset',
        },
      ]);
    });

    it('accepts a request with no body at all', async () => {
      const res = await h.browser().post('/email-otp/request-password-reset', null);

      expect(res.status).toBe(200);
      expect(h.sent).toHaveLength(1);
    });

    it('reports a failed email as 503 EMAIL_DELIVERY_FAILED', async () => {
      h.state.failSends = true;

      const res = await h.browser().post('/email-otp/request-password-reset', { email: '' });

      expect(res.status).toBe(503);
      expect(res.json).toMatchObject({ code: 'EMAIL_DELIVERY_FAILED' });
    });

    it('reports 503 — and logs why — when no account has the admin email', async () => {
      const other = setup();
      await other.seedAdmin('old-test-address@example.com');

      const res = await other.browser().post('/email-otp/request-password-reset', { email: '' });

      expect(res.status).toBe(503);
      expect(res.json).toMatchObject({ code: 'EMAIL_DELIVERY_FAILED' });
      expect(other.sent).toHaveLength(0);
      expect(other.logger.error).toHaveBeenCalledWith(
        'password_reset_account_missing',
        expect.any(Object),
      );
    });

    it('resets without an email, after rejecting a too-short password without spending the code, and signs every session out', async () => {
      const existing = await signedIn(h);
      const tab = h.browser();
      await tab.post('/email-otp/request-password-reset', {});
      const code = h.lastCode();

      const wrong = await tab.post('/email-otp/reset-password', {
        otp: '00000000',
        password: NEW_PASSWORD,
      });
      expect(wrong.status).toBe(400);
      expect(wrong.json).toMatchObject({ code: 'INVALID_OTP' });

      const short = await tab.post('/email-otp/reset-password', { otp: code, password: 'short' });
      expect(short.status).toBe(400);
      expect(short.json).toMatchObject({ code: 'PASSWORD_TOO_SHORT' });

      const reset = await tab.post('/email-otp/reset-password', {
        email: '',
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
      expect(await existing.isSignedIn()).toBe(false);

      const old = await h.browser().post('/sign-in/email', {
        email: ADMIN_EMAIL,
        password: PASSWORD,
      });
      expect(old.status).toBe(401);
      // The new password still only reaches the second factor.
      const fresh = h.browser();
      const signIn = await fresh.post('/sign-in/email', {
        email: ADMIN_EMAIL,
        password: NEW_PASSWORD,
      });
      expect(signIn.json).toMatchObject({ twoFactorRedirect: true });
      expect(fresh.has('session_token')).toBe(false);
    });

    it('locks the code after three wrong guesses', async () => {
      const tab = h.browser();
      await tab.post('/email-otp/request-password-reset', {});
      const code = h.lastCode();
      for (let i = 0; i < 3; i += 1) {
        await tab.post('/email-otp/reset-password', { otp: '00000000', password: NEW_PASSWORD });
      }

      const res = await tab.post('/email-otp/reset-password', {
        otp: code,
        password: NEW_PASSWORD,
      });

      expect(res.status).toBe(403);
      expect(res.json).toMatchObject({ code: 'TOO_MANY_ATTEMPTS' });
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
  'POST /two-factor/disable', // disabled — 2FA is mandatory
  'POST /two-factor/enable', // disabled — enrolment is automatic
  'POST /two-factor/generate-backup-codes',
  'POST /two-factor/get-totp-uri', // disabled
  'POST /two-factor/send-otp', // sign-in challenge only
  'POST /two-factor/verify-backup-code', // sign-in challenge only
  'POST /two-factor/verify-otp', // sign-in challenge only
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

describe('two-step verification lockout', () => {
  let h: Harness;

  beforeEach(async () => {
    h = setup();
    await h.seedAdmin();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not sign anyone out on an ordinary 2FA sign-in', async () => {
    const first = await signedIn(h);
    const second = await signedIn(h);

    expect(await first.isSignedIn()).toBe(true);
    expect(await second.isSignedIn()).toBe(true);
  });

  it('locks the account after 10 failed codes across challenges, and unlocks after 15 minutes', async () => {
    const start = new Date('2026-10-03T10:00:00Z');
    vi.useFakeTimers({ toFake: ['Date'], now: start });
    const tab = await passwordStep(h);

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
    const later = await passwordStep(h);
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

    const missing = await h.browser().post('/email-otp/request-password-reset', {});
    expect(missing.status).toBe(400);
    expect(missing.json).toMatchObject({ code: 'MISSING_RESPONSE' });

    const bad = await h
      .browser()
      .post('/email-otp/request-password-reset', {}, { 'x-captcha-response': 'bad-token' });
    expect(bad.status).toBe(403);
    expect(bad.json).toMatchObject({ code: 'VERIFICATION_FAILED' });
    expect(h.sent).toHaveLength(0);

    const good = await h
      .browser()
      .post('/email-otp/request-password-reset', {}, { 'x-captcha-response': 'good-token' });
    expect(good.status).toBe(200);
    expect(good.json).toEqual({ success: true });
    expect(h.sent).toHaveLength(1);
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
      otp: '00000000',
      password: NEW_PASSWORD,
    });

    expect(signIn.status).toBe(200);
    expect(signIn.json).toMatchObject({ twoFactorRedirect: true });
    expect(reset.json).toMatchObject({ code: 'INVALID_OTP' });
    expect(siteverify).not.toHaveBeenCalled();
  });

  it('fails closed in production when no Turnstile secret is configured', async () => {
    const h = await withCaptcha({ secretKey: undefined, required: true });

    const res = await h.browser().post('/email-otp/request-password-reset', {});

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
      .post('/email-otp/request-password-reset', {}, token ? { 'x-captcha-response': token } : {});

  it('is not spent by requests that fail Turnstile', async () => {
    const h = await harness();
    for (let i = 0; i < 12; i += 1) {
      expect((await request(h)).json).toMatchObject({ code: 'MISSING_RESPONSE' });
      expect((await request(h, 'bad-token')).json).toMatchObject({ code: 'VERIFICATION_FAILED' });
    }

    // The whole hourly budget is still there.
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
