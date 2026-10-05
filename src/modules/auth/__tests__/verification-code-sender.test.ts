// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EmailClient } from '@/modules/integrations';
import { IntegrationError } from '@/modules/shared/lib/errors';
import type { Logger } from '@/modules/shared/lib/logger';
import { err, ok } from '@/modules/shared/lib/result';
import {
  createVerificationCodeSender,
  type VerificationCodeSenderDeps,
} from '../verification-code-sender';

function makeLogger(): Logger {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function makeEmailClient(result: Awaited<ReturnType<EmailClient['send']>> = ok({ id: 'email-1' })) {
  const send = vi.fn<EmailClient['send']>().mockResolvedValue(result);
  return { client: { send } satisfies EmailClient, send };
}

function makeSender(overrides: Partial<VerificationCodeSenderDeps> = {}) {
  const email = makeEmailClient();
  const logger = makeLogger();
  const deps: VerificationCodeSenderDeps = {
    emailClient: email.client,
    emailDeliveryConfigured: true,
    logCodesWhenUnconfigured: true,
    expiresInMinutes: 5,
    logger,
    ...overrides,
  };
  return { sender: createVerificationCodeSender(deps), send: email.send, logger };
}

const INPUT = { to: 'admin@example.com', code: '12345678', purpose: 'sign-in' as const };

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('createVerificationCodeSender', () => {
  it('emails the code with a subject, a React body and a plain-text body', async () => {
    const { sender, send } = makeSender();

    const result = await sender.send(INPUT);

    expect(result.ok).toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
    const message = send.mock.calls[0]![0];
    expect(message.to).toBe('admin@example.com');
    expect(message.subject).toBe('Your sign-in code — The Culprit');
    expect(message.text).toContain('12345678');
    expect(message.text).toContain('expires in 5 minutes');
    expect(message.react.props).toEqual({
      code: '12345678',
      purpose: 'sign-in',
      expiresInMinutes: 5,
    });
  });

  it('returns the transport error, and logs neither the code nor the address', async () => {
    const failure = new IntegrationError('Email delivery failed.');
    const { client } = makeEmailClient(err(failure));
    const { sender, logger } = makeSender({ emailClient: client });

    const result = await sender.send(INPUT);

    expect(result).toEqual({ ok: false, error: failure });
    expect(logger.error).toHaveBeenCalledWith('verification_code_send_failed', {
      purpose: 'sign-in',
    });
    expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toContain('12345678');
    expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toContain('admin@example.com');
  });

  it('outside production, with no transport, logs the code instead of sending', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const { sender, send, logger } = makeSender({ emailDeliveryConfigured: false });

    const result = await sender.send(INPUT);

    expect(result.ok).toBe(true);
    expect(send).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith('verification_code_dev_only', {
      purpose: 'sign-in',
      code: '12345678',
    });
  });

  it('in production, with no transport, fails and never logs the code', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    // Even if the flag were wrongly left on, production must not write a code to the log.
    const { sender, send, logger } = makeSender({
      emailDeliveryConfigured: false,
      logCodesWhenUnconfigured: true,
    });

    const result = await sender.send(INPUT);

    expect(result.ok).toBe(false);
    expect(send).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toContain('12345678');
  });

  it('with no transport and code logging off, fails without logging the code', async () => {
    const { sender, logger } = makeSender({
      emailDeliveryConfigured: false,
      logCodesWhenUnconfigured: false,
    });

    const result = await sender.send(INPUT);

    expect(result.ok).toBe(false);
    expect(logger.info).not.toHaveBeenCalled();
  });
});
