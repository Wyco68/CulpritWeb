// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { GenericEndpointContext } from 'better-auth';
import { symmetricDecrypt } from 'better-auth/crypto';
import { IntegrationError } from '@/modules/shared/lib/errors';
import { err, ok } from '@/modules/shared/lib/result';
import { createHash } from 'node:crypto';
import {
  DISABLED_AUTH_PATHS,
  createOtpHasher,
  createPasswordResetOtpSender,
  createTwoFactorOtpSender,
  encodeBackupCodes,
} from '../auth-security';
import type { VerificationCodeSender } from '../verification-code-sender';

function makeSender(result: Awaited<ReturnType<VerificationCodeSender['send']>> = ok(undefined)) {
  const send = vi.fn<VerificationCodeSender['send']>().mockResolvedValue(result);
  return { sender: { send } satisfies VerificationCodeSender, send };
}

/** The slice of a Better Auth request context the senders touch: the per-request object. */
function fakeCtx(): GenericEndpointContext {
  return { context: {} } as unknown as GenericEndpointContext;
}

describe('createPasswordResetOtpSender', () => {
  it('sends the code for a forget-password request, ignoring the payload address', async () => {
    const { sender, send } = makeSender();

    await createPasswordResetOtpSender(sender)({
      email: 'someone-else@example.com',
      otp: '12345678',
      type: 'forget-password',
    });

    expect(send).toHaveBeenCalledWith({ code: '12345678', purpose: 'password-reset' });
  });

  it.each(['sign-in', 'email-verification', 'change-email'])(
    'sends nothing for a %s code',
    async (type) => {
      const { sender, send } = makeSender();

      await createPasswordResetOtpSender(sender)({ email: 'a@example.com', otp: '1', type });

      expect(send).not.toHaveBeenCalled();
    },
  );

  it('awaits the send before returning (no fire-and-forget)', async () => {
    let settled = false;
    const send = vi.fn<VerificationCodeSender['send']>().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      settled = true;
      return ok(undefined);
    });

    await createPasswordResetOtpSender({ send })(
      { email: 'x@example.com', otp: '12345678', type: 'forget-password' },
      fakeCtx(),
    );

    expect(settled).toBe(true);
  });

  it('does not throw when delivery fails — the after-hook reports it as 503', async () => {
    const { sender } = makeSender(err(new IntegrationError()));

    await expect(
      createPasswordResetOtpSender(sender)(
        { email: 'x@example.com', otp: '12345678', type: 'forget-password' },
        fakeCtx(),
      ),
    ).resolves.toBeUndefined();
  });
});

describe('createTwoFactorOtpSender', () => {
  it('sends a sign-in code, without passing on the user record', async () => {
    const { sender, send } = makeSender();

    await createTwoFactorOtpSender(sender)({ otp: '12345678' });

    expect(send).toHaveBeenCalledWith({ code: '12345678', purpose: 'sign-in' });
  });

  it('throws when delivery fails', async () => {
    const failure = new IntegrationError();
    const { sender } = makeSender(err(failure));

    await expect(createTwoFactorOtpSender(sender)({ otp: '12345678' }, fakeCtx())).rejects.toBe(
      failure,
    );
  });
});

describe('encodeBackupCodes', () => {
  it('stores the JSON list encrypted with the auth secret, as the plugin reads it back', async () => {
    const codes = ['abcde-12345', 'ABCDE-67890'];
    const key = 'test-secret-that-is-at-least-32-characters-long';

    const stored = await encodeBackupCodes(codes, key);

    expect(stored).not.toContain('abcde');
    expect(JSON.parse(await symmetricDecrypt({ key, data: stored }))).toEqual(codes);
  });
});

describe('createOtpHasher', () => {
  it('is keyed: the same code hashes differently under a different secret', async () => {
    const a = await createOtpHasher('secret-a').hash('12345678');
    const b = await createOtpHasher('secret-b').hash('12345678');

    expect(a).not.toBe(b);
    expect(await createOtpHasher('secret-a').hash('12345678')).toBe(a);
  });

  it('is not the plain SHA-256 the plugins would otherwise store', async () => {
    const keyed = await createOtpHasher('secret').hash('12345678');
    const unkeyed = createHash('sha256').update('12345678').digest('base64url');

    expect(keyed).not.toBe(unkeyed);
    expect(keyed).not.toContain('12345678');
  });
});

describe('DISABLED_AUTH_PATHS', () => {
  it('switches off turning 2FA on/off, passwordless sign-in and TOTP, and keeps the rest', () => {
    expect(DISABLED_AUTH_PATHS).toContain('/two-factor/enable');
    expect(DISABLED_AUTH_PATHS).toContain('/two-factor/disable');
    expect(DISABLED_AUTH_PATHS).toContain('/sign-in/email-otp');
    expect(DISABLED_AUTH_PATHS).toContain('/two-factor/get-totp-uri');
    expect(DISABLED_AUTH_PATHS).toContain('/two-factor/verify-totp');
    expect(DISABLED_AUTH_PATHS).not.toContain('/two-factor/generate-backup-codes');
    expect(DISABLED_AUTH_PATHS).not.toContain('/two-factor/verify-backup-code');
    expect(DISABLED_AUTH_PATHS).not.toContain('/email-otp/request-password-reset');
    expect(DISABLED_AUTH_PATHS).not.toContain('/email-otp/reset-password');
  });
});
