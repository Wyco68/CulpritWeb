// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { IntegrationError } from '@/modules/shared/lib/errors';
import { err, ok } from '@/modules/shared/lib/result';
import { createHash } from 'node:crypto';
import {
  DISABLED_AUTH_PATHS,
  createOtpHasher,
  createPasswordResetOtpSender,
  createTwoFactorOtpSender,
} from '../auth-security';
import type { VerificationCodeSender } from '../verification-code-sender';

function makeSender(result: Awaited<ReturnType<VerificationCodeSender['send']>> = ok(undefined)) {
  const send = vi.fn<VerificationCodeSender['send']>().mockResolvedValue(result);
  return { sender: { send } satisfies VerificationCodeSender, send };
}

describe('createPasswordResetOtpSender', () => {
  it('sends the code for a forget-password request', async () => {
    const { sender, send } = makeSender();

    await createPasswordResetOtpSender(sender)({
      email: 'admin@example.com',
      otp: '12345678',
      type: 'forget-password',
    });

    expect(send).toHaveBeenCalledWith({
      to: 'admin@example.com',
      code: '12345678',
      purpose: 'password-reset',
    });
  });

  it.each(['sign-in', 'email-verification', 'change-email'])(
    'sends nothing for a %s code',
    async (type) => {
      const { sender, send } = makeSender();

      await createPasswordResetOtpSender(sender)({ email: 'a@example.com', otp: '1', type });

      expect(send).not.toHaveBeenCalled();
    },
  );

  it('does not throw when delivery fails, so the request stays uniform', async () => {
    const { sender } = makeSender(err(new IntegrationError()));

    await expect(
      createPasswordResetOtpSender(sender)({
        email: 'admin@example.com',
        otp: '12345678',
        type: 'forget-password',
      }),
    ).resolves.toBeUndefined();
  });

  it('returns before the send settles, so a real address answers no slower than a fake one', async () => {
    let settle: (value: Awaited<ReturnType<VerificationCodeSender['send']>>) => void = () => {};
    const pending = new Promise<Awaited<ReturnType<VerificationCodeSender['send']>>>((resolve) => {
      settle = resolve;
    });
    const send = vi.fn<VerificationCodeSender['send']>().mockReturnValue(pending);
    let sendSettled = false;
    void pending.then(() => {
      sendSettled = true;
    });

    await createPasswordResetOtpSender({ send })({
      email: 'admin@example.com',
      otp: '12345678',
      type: 'forget-password',
    });

    expect(send).toHaveBeenCalledTimes(1);
    expect(sendSettled).toBe(false);
    settle(ok(undefined));
  });

  it('swallows an unexpected rejection from the sender (no unhandled rejection)', async () => {
    const send = vi.fn<VerificationCodeSender['send']>().mockRejectedValue(new Error('boom'));

    await expect(
      createPasswordResetOtpSender({ send })({
        email: 'admin@example.com',
        otp: '12345678',
        type: 'forget-password',
      }),
    ).resolves.toBeUndefined();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});

describe('createTwoFactorOtpSender', () => {
  it('sends a sign-in code once 2FA is on', async () => {
    const { sender, send } = makeSender();

    await createTwoFactorOtpSender(sender)({
      user: { email: 'admin@example.com', twoFactorEnabled: true },
      otp: '12345678',
    });

    expect(send).toHaveBeenCalledWith({
      to: 'admin@example.com',
      code: '12345678',
      purpose: 'sign-in',
    });
  });

  it('sends the confirm-2FA code while it is still off', async () => {
    const { sender, send } = makeSender();

    await createTwoFactorOtpSender(sender)({
      user: { email: 'admin@example.com', twoFactorEnabled: false },
      otp: '12345678',
    });

    expect(send).toHaveBeenCalledWith(expect.objectContaining({ purpose: 'enable-two-factor' }));
  });

  it('throws when delivery fails', async () => {
    const failure = new IntegrationError();
    const { sender } = makeSender(err(failure));

    await expect(
      createTwoFactorOtpSender(sender)({
        user: { email: 'admin@example.com', twoFactorEnabled: true },
        otp: '12345678',
      }),
    ).rejects.toBe(failure);
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
  it('switches off passwordless sign-in and TOTP, and keeps the reset-by-code endpoints', () => {
    expect(DISABLED_AUTH_PATHS).toContain('/sign-in/email-otp');
    expect(DISABLED_AUTH_PATHS).toContain('/two-factor/get-totp-uri');
    expect(DISABLED_AUTH_PATHS).toContain('/two-factor/verify-totp');
    expect(DISABLED_AUTH_PATHS).not.toContain('/email-otp/request-password-reset');
    expect(DISABLED_AUTH_PATHS).not.toContain('/email-otp/reset-password');
  });
});
