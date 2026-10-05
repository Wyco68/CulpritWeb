'use client';

import { useEffect, useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/modules/shared/ui/button';
import { twoFactor } from '../auth-client';
import { CODE_DIGITS, CODE_TTL_MINUTES } from '../auth-policy';
import { backupCodeSchema, verificationCodeSchema } from '../two-factor.schema';
import { authErrorMessage, isChallengeExpired, runAuthRequest } from './auth-error-message';
import { CodeField } from './code-field';
import { FormAlert, FormNotice } from './form-alert';
import { ResendCodeButton } from './resend-code-button';
import { useResendCooldown } from './use-resend-cooldown';

// The second step of every sign-in — two-step verification is mandatory (ADR-022, ADR-023). The
// password step has already been accepted and the first code requested — by the password form's
// submit handler, not from an effect here, since a remount (React's development double-run, a fast
// refresh) would spend one of the five sends allowed per ten minutes.
//
// Two ways to answer: the emailed code, or a one-time backup code when the mailbox is out of reach.
// No "trust this browser" — the server overrides it, so it is not offered.

export interface TwoFactorChallengeProps {
  /** Where the code went, already masked (ADMIN_EMAIL_MASKED). */
  maskedEmail: string;
  /** Why the first code could not be sent, or null when it went out. */
  initialSendError: string | null;
  /** The challenge was answered and the session cookie is set. */
  onVerified: () => void;
  /** Back to the password step — with a reason when the challenge expired, null when chosen. */
  onRestart: (reason: string | null) => void;
}

type Mode = 'code' | 'backup';

export function TwoFactorChallenge({
  maskedEmail,
  initialSendError,
  onVerified,
  onRestart,
}: TwoFactorChallengeProps) {
  const [mode, setMode] = useState<Mode>('code');
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <h2 id={headingId} className="font-serif text-xl text-foreground">
          {mode === 'code' ? 'Check your email' : 'Use a backup code'}
        </h2>
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
          {mode === 'code'
            ? 'Every sign-in needs a code from the admin mailbox as well as your password.'
            : 'Each backup code works once. Use one you saved from the Security page when the mailbox is out of reach.'}
        </p>
      </div>

      {/* Both stay mounted, so switching back and forth keeps the resend countdown and any
          message instead of starting over. `hidden` takes the inactive one out of the page and
          the accessibility tree. */}
      <div hidden={mode !== 'code'}>
        <EmailedCodeForm
          active={mode === 'code'}
          maskedEmail={maskedEmail}
          initialSendError={initialSendError}
          onVerified={onVerified}
          onRestart={onRestart}
        />
      </div>
      <div hidden={mode !== 'backup'}>
        <BackupCodeForm active={mode === 'backup'} onVerified={onVerified} onRestart={onRestart} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
        <Button type="button" variant="ghost" size="sm" onClick={() => onRestart(null)}>
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Back
        </Button>
        <Button
          type="button"
          variant="link"
          size="sm"
          className="px-0"
          onClick={() => setMode(mode === 'code' ? 'backup' : 'code')}
        >
          {mode === 'code' ? 'Use a backup code instead' : 'Use an emailed code instead'}
        </Button>
      </div>
    </section>
  );
}

type CodeFormInput = z.input<typeof verificationCodeSchema>;
type CodeFormOutput = z.output<typeof verificationCodeSchema>;

/** Whether this answer form is the one on screen; it takes focus when it becomes so. */
type FormProps = { active: boolean };

function EmailedCodeForm({
  active,
  maskedEmail,
  initialSendError,
  onVerified,
  onRestart,
}: TwoFactorChallengeProps & FormProps) {
  const [formError, setFormError] = useState<string | null>(initialSendError);
  const [notice, setNotice] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [verified, setVerified] = useState(false);
  const cooldown = useResendCooldown({ startActive: initialSendError === null });

  const {
    register,
    handleSubmit,
    setFocus,
    resetField,
    formState: { errors, isSubmitting },
  } = useForm<CodeFormInput, unknown, CodeFormOutput>({
    resolver: zodResolver(verificationCodeSchema),
    defaultValues: { code: '' },
  });

  // Focus, not a request: moving into this step lands on the field that needs typing, and its
  // label and description are what a screen reader announces for the new step.
  useEffect(() => {
    if (active) setFocus('code');
  }, [active, setFocus]);

  async function onSubmit({ code }: CodeFormOutput) {
    setFormError(null);
    const { error } = await runAuthRequest(() => twoFactor.verifyOtp({ code }));
    if (error) {
      const message = authErrorMessage(error, "Couldn't verify the code. Please try again.");
      if (isChallengeExpired(error)) return onRestart(message);
      setNotice(null);
      setFormError(message);
      resetField('code');
      setFocus('code');
      return;
    }
    setVerified(true);
    onVerified();
  }

  async function resend() {
    setFormError(null);
    setResending(true);
    const { error } = await runAuthRequest(() => twoFactor.sendOtp());
    setResending(false);
    if (error) {
      const message = authErrorMessage(error, "Couldn't send a new code. Please try again.");
      if (isChallengeExpired(error)) return onRestart(message);
      setNotice(null);
      setFormError(message);
      return;
    }
    cooldown.start();
    setNotice(`A new code is on its way to ${maskedEmail}.`);
    setFocus('code');
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      {formError && <FormAlert>{formError}</FormAlert>}
      <FormNotice message={notice} />

      <CodeField
        id="two-factor-code"
        registration={register('code')}
        error={errors.code?.message}
        description={`We sent an ${CODE_DIGITS}-digit code to ${maskedEmail}. It expires ${CODE_TTL_MINUTES} minutes after it was sent.`}
      />

      <div className="flex flex-col gap-3">
        <Button type="submit" size="lg" loading={isSubmitting || verified}>
          Verify and sign in
        </Button>
        <div className="flex justify-center">
          <ResendCodeButton
            onResend={resend}
            remaining={cooldown.remaining}
            loading={resending}
            disabled={isSubmitting || verified}
          />
        </div>
      </div>
    </form>
  );
}

type BackupFormInput = z.input<typeof backupCodeSchema>;
type BackupFormOutput = z.output<typeof backupCodeSchema>;

function BackupCodeForm({
  active,
  onVerified,
  onRestart,
}: Pick<TwoFactorChallengeProps, 'onVerified' | 'onRestart'> & FormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);

  const {
    register,
    handleSubmit,
    setFocus,
    resetField,
    formState: { errors, isSubmitting },
  } = useForm<BackupFormInput, unknown, BackupFormOutput>({
    resolver: zodResolver(backupCodeSchema),
    defaultValues: { code: '' },
  });

  useEffect(() => {
    if (active) setFocus('code');
  }, [active, setFocus]);

  async function onSubmit({ code }: BackupFormOutput) {
    setFormError(null);
    const { error } = await runAuthRequest(() => twoFactor.verifyBackupCode({ code }));
    if (error) {
      const message = authErrorMessage(error, "Couldn't verify the backup code. Please try again.");
      if (isChallengeExpired(error)) return onRestart(message);
      setFormError(message);
      resetField('code');
      setFocus('code');
      return;
    }
    setVerified(true);
    onVerified();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      {formError && <FormAlert>{formError}</FormAlert>}

      <CodeField
        id="two-factor-backup-code"
        kind="backup"
        registration={register('code')}
        error={errors.code?.message}
        description="Ten characters with a dash in the middle, like abcde-12345."
      />

      <Button type="submit" size="lg" loading={isSubmitting || verified}>
        Verify and sign in
      </Button>
    </form>
  );
}
