import { createElement } from 'react';
import type { EmailClient } from '@/modules/integrations';
import { IntegrationError } from '@/modules/shared/lib/errors';
import type { Logger } from '@/modules/shared/lib/logger';
import { err, ok, type Result } from '@/modules/shared/lib/result';
import {
  VerificationCodeEmail,
  verificationCodeSubject,
  verificationCodeText,
  type VerificationCodePurpose,
} from './emails/verification-code-email';

// Delivers the 8-digit codes Better Auth generates (two-factor sign-in, confirming 2FA, password
// reset — ADR-022). Framework-agnostic: Better Auth's callbacks are thin adapters over this
// (see ./auth-security.ts), and every edge (transport, config, logger) is injected so it is
// unit-testable without env or network.

export type SendVerificationCodeInput = {
  to: string;
  code: string;
  purpose: VerificationCodePurpose;
};

export interface VerificationCodeSender {
  send(input: SendVerificationCodeInput): Promise<Result<void, IntegrationError>>;
}

export type VerificationCodeSenderDeps = {
  emailClient: EmailClient;
  /** True when a real transport is configured (RESEND_API_KEY + EMAIL_FROM), not the no-op. */
  emailDeliveryConfigured: boolean;
  /**
   * Local development only: with no transport configured, write the code to the server log so the
   * flow can be exercised. Ignored whenever NODE_ENV is 'production', whatever is passed here.
   */
  logCodesWhenUnconfigured: boolean;
  /** Minutes the code stays valid — shown in the email; must match the plugin option it came from. */
  expiresInMinutes: number;
  logger: Logger;
};

export function createVerificationCodeSender(
  deps: VerificationCodeSenderDeps,
): VerificationCodeSender {
  return {
    async send({ to, code, purpose }) {
      if (!deps.emailDeliveryConfigured) {
        if (deps.logCodesWhenUnconfigured && process.env.NODE_ENV !== 'production') {
          deps.logger.info('verification_code_dev_only', { purpose, code });
          return ok(undefined);
        }
        deps.logger.error('verification_code_undeliverable', {
          purpose,
          reason: 'RESEND_API_KEY / EMAIL_FROM are not configured',
        });
        return err(new IntegrationError('Email delivery is not configured.'));
      }

      const props = { code, purpose, expiresInMinutes: deps.expiresInMinutes };
      const result = await deps.emailClient.send({
        to,
        subject: verificationCodeSubject(purpose),
        react: createElement(VerificationCodeEmail, props),
        text: verificationCodeText(props),
      });
      if (!result.ok) {
        // Never log the code or the address — the purpose is enough to trace a delivery failure.
        deps.logger.error('verification_code_send_failed', { purpose });
        return err(result.error);
      }
      return ok(undefined);
    },
  };
}
