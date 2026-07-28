import type { ReactElement } from 'react';
import { env } from '@/modules/shared/lib/env.server';
import { logger } from '@/modules/shared/lib/logger';
import { IntegrationError } from '@/modules/shared/lib/errors';
import { err, ok, type Result } from '@/modules/shared/lib/result';

// Transport-only edge. Templates + status->template mapping live in the notifications module.
export interface SendEmailInput {
  to: string;
  subject: string;
  react: ReactElement;
  text: string;
}

export interface EmailClient {
  send(input: SendEmailInput): Promise<Result<{ id: string }, IntegrationError>>;
}

/** No-op transport for dev/test when RESEND_API_KEY is unset — logs instead of crashing. */
export class NoopEmailClient implements EmailClient {
  async send(input: SendEmailInput): Promise<Result<{ id: string }, IntegrationError>> {
    logger.info('email_noop', { subject: input.subject });
    return ok({ id: 'noop' });
  }
}

/** Resend + React Email transport. Renders the component to HTML, sends via Resend. */
export class ResendEmailClient implements EmailClient {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(input: SendEmailInput): Promise<Result<{ id: string }, IntegrationError>> {
    try {
      // Dynamic imports keep these server-only deps out of any accidental client bundle.
      const [{ Resend }, { render }] = await Promise.all([
        import('resend'),
        import('@react-email/render'),
      ]);
      const resend = new Resend(this.apiKey);
      const html = await render(input.react);
      const { data, error } = await resend.emails.send({
        from: this.from,
        to: input.to,
        subject: input.subject,
        html,
        text: input.text,
      });
      if (error) return err(new IntegrationError('Email delivery failed.', error));
      return ok({ id: data?.id ?? 'unknown' });
    } catch (cause) {
      return err(new IntegrationError('Email delivery failed.', cause));
    }
  }
}

let cached: EmailClient | undefined;

/** Factory: real Resend client when configured, else a logging no-op. Cached per process. */
export function getEmailClient(): EmailClient {
  if (cached) return cached;
  cached =
    env.RESEND_API_KEY && env.EMAIL_FROM
      ? new ResendEmailClient(env.RESEND_API_KEY, env.EMAIL_FROM)
      : new NoopEmailClient();
  return cached;
}
