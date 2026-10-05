'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Button } from '@/modules/shared/ui/button';
import { Input } from '@/modules/shared/ui/input';
import { FormField } from '@/modules/shared/ui/form-field';
import { emailOtp } from '../auth-client';
import { CAPTCHA_HEADER, CODE_DIGITS, CODE_TTL_MINUTES, PASSWORD_POLICY } from '../auth-policy';
import { resetPasswordSchema } from '../password-reset.schema';
import {
  authErrorMessage,
  parseRetryAfter,
  resetRequestErrorMessage,
  runAuthRequest,
} from './auth-error-message';
import { CodeField } from './code-field';
import { FormAlert, FormNotice } from './form-alert';
import { HumanCheck } from './human-check';
import { ResendCodeButton } from './resend-code-button';
import { useResendCooldown } from './use-resend-cooldown';

// "Forgot password" by emailed 8-digit code (ADR-022, ADR-023), in two steps on one page: ask for a
// code, then enter it with the new password.
//
// There is no email field. The site has one admin and every code goes to its fixed mailbox, so the
// server ignores any address a client sends (the form sends `email: ''`) and reports honestly
// whether the email went out: `{ success: true }` means sent, `503 EMAIL_DELIVERY_FAILED` means
// not. Every failure therefore keeps the visitor on the first step, with the reason.
//
// Every code request — the first and each "Resend code" — carries a fresh Cloudflare Turnstile
// token in the `x-captcha-response` header. Tokens are single-use, so the check is started over
// after every attempt, whatever its outcome. With no site key configured the check is skipped, as
// the server skips it too outside production.
//
// A completed reset signs out every session and does not sign in. The admin is sent to /login and
// signs in with the new password, then the emailed code.

/**
 * One code request. A 429 here may be the per-IP limit or a site-wide cap lasting up to a day, so
 * the response's `Retry-After` is read (through the client's `onError` hook — the only place it
 * exposes the response) and carried on the error for the message.
 */
async function requestResetCode(captchaToken: string | null) {
  let retryAfterSeconds: number | undefined;
  const result = await runAuthRequest(() =>
    emailOtp.requestPasswordReset(
      // The server fills in the admin's address; an empty one satisfies the client's types.
      { email: '' },
      {
        ...(captchaToken ? { headers: { [CAPTCHA_HEADER]: captchaToken } } : {}),
        onError: ({ response }) => {
          retryAfterSeconds = parseRetryAfter(response.headers);
        },
      },
    ),
  );
  if (!result.error || retryAfterSeconds === undefined) return result;
  return { data: null, error: { ...result.error, retryAfterSeconds } };
}

export interface ForgotPasswordFormProps {
  /**
   * Where the code is emailed, already masked (ADMIN_EMAIL_MASKED). Passed from the Server
   * Component page so the full address never reaches the browser bundle.
   */
  maskedEmail: string;
  /** NEXT_PUBLIC_TURNSTILE_SITE_KEY. Absent: no human check is shown. */
  turnstileSiteKey?: string;
}

export function ForgotPasswordForm({ maskedEmail, turnstileSiteKey }: ForgotPasswordFormProps) {
  const [requested, setRequested] = useState(false);

  if (!requested) {
    return (
      <RequestCodeStep
        maskedEmail={maskedEmail}
        turnstileSiteKey={turnstileSiteKey}
        onRequested={() => setRequested(true)}
      />
    );
  }
  return <ResetPasswordStep maskedEmail={maskedEmail} turnstileSiteKey={turnstileSiteKey} />;
}

interface StepProps {
  maskedEmail: string;
  turnstileSiteKey?: string;
}

/**
 * Step 1 — no input to fill in, only the human check and a button. Still a form, so Enter submits
 * it. Nothing takes focus on page load, so a screen reader starts at the page's heading.
 */
function RequestCodeStep({
  maskedEmail,
  turnstileSiteKey,
  onRequested,
}: StepProps & { onRequested: () => void }) {
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  // Bumped after every attempt: remounts the check, since the token it gave is now spent.
  const [captchaRound, setCaptchaRound] = useState(0);
  const needsCheck = Boolean(turnstileSiteKey);
  const checkStatusId = 'reset-human-check-status';
  const explanationId = 'reset-request-explanation';

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || (needsCheck && !captchaToken)) return;
    setFormError(null);
    setSubmitting(true);
    const token = captchaToken;
    setCaptchaToken(null);
    setCaptchaRound((round) => round + 1);

    const { error } = await requestResetCode(token);
    setSubmitting(false);
    if (error) {
      setFormError(
        resetRequestErrorMessage(error, "Couldn't send a reset code. Please try again."),
      );
      return;
    }
    onRequested();
  }

  const waiting = needsCheck && !captchaToken;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {formError && <FormAlert>{formError}</FormAlert>}

      <p id={explanationId} className="text-pretty text-sm leading-relaxed text-muted-foreground">
        We&apos;ll email an {CODE_DIGITS}-digit code to the admin mailbox,{' '}
        <span className="font-medium text-foreground">{maskedEmail}</span>. Enter it on the next
        step with your new password.
      </p>

      {turnstileSiteKey && (
        <HumanCheck
          key={captchaRound}
          siteKey={turnstileSiteKey}
          onTokenChange={setCaptchaToken}
          statusId={checkStatusId}
          waitingText="Complete the check to send a code."
        />
      )}

      <Button
        type="submit"
        size="lg"
        loading={submitting}
        disabled={waiting}
        aria-describedby={needsCheck ? `${explanationId} ${checkStatusId}` : explanationId}
        className="mt-1"
      >
        Send reset code
      </Button>
    </form>
  );
}

type ResetInput = z.input<typeof resetPasswordSchema>;
type ResetOutput = z.output<typeof resetPasswordSchema>;

/** Step 2 — the code from the email, and the new password twice. */
function ResetPasswordStep({ maskedEmail, turnstileSiteKey }: StepProps) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  // "Resend code" with a human check: the check opens on demand, and a passed check only enables
  // "Send new code" — the request itself always needs a click. Sending straight from the token
  // callback looped after a failure: the remounted check auto-solves, which sent again, and so on.
  const [resendCheckOpen, setResendCheckOpen] = useState(false);
  const [resendToken, setResendToken] = useState<string | null>(null);
  const [resendCheckRound, setResendCheckRound] = useState(0);
  const resendCheckRef = useRef<HTMLDivElement>(null);
  const [done, setDone] = useState(false);
  const cooldown = useResendCooldown({ startActive: true });

  const {
    register,
    handleSubmit,
    setFocus,
    setError,
    resetField,
    formState: { errors, isSubmitting },
  } = useForm<ResetInput, unknown, ResetOutput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { otp: '', password: '', confirmPassword: '' },
  });

  // Entering this step lands on the code field; its description says where the code went.
  useEffect(() => {
    setFocus('otp');
  }, [setFocus]);

  // The check takes focus when it opens, so a keyboard or screen-reader user is taken to it.
  useEffect(() => {
    if (resendCheckOpen) resendCheckRef.current?.focus();
  }, [resendCheckOpen]);

  async function onSubmit(values: ResetOutput) {
    setFormError(null);
    // `confirmPassword` is the form's own check and never leaves the browser. The server fills in
    // the admin's address.
    const { error } = await runAuthRequest(() =>
      emailOtp.resetPassword({ email: '', otp: values.otp, password: values.password }),
    );
    if (error) {
      setNotice(null);
      const message = authErrorMessage(error, "Couldn't reset the password. Please try again.");
      // The server checks the password's length before it spends the code, so the code is still
      // good: point at the password, keep the code.
      if (error.code === 'PASSWORD_TOO_SHORT' || error.code === 'PASSWORD_TOO_LONG') {
        setError('password', { message }, { shouldFocus: true });
        return;
      }
      setFormError(message);
      resetField('otp');
      setFocus('otp');
      return;
    }
    setDone(true);
    toast.success('Password changed. Sign in with your new password.');
    router.push('/login');
  }

  async function resend(captchaToken: string | null) {
    setFormError(null);
    setResending(true);
    if (captchaToken) {
      // Spent by this request whatever its outcome: the check starts over, and a new token only
      // re-enables the button.
      setResendToken(null);
      setResendCheckRound((round) => round + 1);
    }
    const { error } = await requestResetCode(captchaToken);
    setResending(false);
    if (error) {
      setNotice(null);
      setFormError(resetRequestErrorMessage(error, "Couldn't send a new code. Please try again."));
      return;
    }
    setResendCheckOpen(false);
    setResendToken(null);
    cooldown.start();
    setNotice(`A new code is on its way to ${maskedEmail}.`);
    setFocus('otp');
  }

  function startResend() {
    if (turnstileSiteKey) setResendCheckOpen(true);
    else void resend(null);
  }

  function closeResendCheck() {
    setResendCheckOpen(false);
    setResendToken(null);
  }

  const busy = isSubmitting || done;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      {formError && <FormAlert>{formError}</FormAlert>}
      <FormNotice message={notice} />

      <CodeField
        id="reset-code"
        registration={register('otp')}
        error={errors.otp?.message}
        description={`We sent a code to ${maskedEmail}. It expires ${CODE_TTL_MINUTES} minutes after it was sent.`}
      />

      <FormField
        label="New password"
        htmlFor="reset-password"
        description={`${PASSWORD_POLICY.minPasswordLength} to ${PASSWORD_POLICY.maxPasswordLength} characters. Every signed-in session is signed out.`}
        error={errors.password?.message}
        required
      >
        {(fieldProps) => (
          <Input
            {...fieldProps}
            {...register('password')}
            type="password"
            autoComplete="new-password"
          />
        )}
      </FormField>

      <FormField
        label="Confirm new password"
        htmlFor="reset-confirm-password"
        error={errors.confirmPassword?.message}
        required
      >
        {(fieldProps) => (
          <Input
            {...fieldProps}
            {...register('confirmPassword')}
            type="password"
            autoComplete="new-password"
          />
        )}
      </FormField>

      <div className="flex flex-col gap-3">
        <Button type="submit" size="lg" loading={busy} className="mt-1">
          Set new password
        </Button>
        <div className="flex justify-center">
          <ResendCodeButton
            onResend={startResend}
            remaining={cooldown.remaining}
            loading={resending}
            disabled={busy || resendCheckOpen}
          />
        </div>

        {turnstileSiteKey && resendCheckOpen && (
          <div
            ref={resendCheckRef}
            tabIndex={-1}
            className="focus-ring flex flex-col gap-2 rounded-md"
          >
            <HumanCheck
              key={resendCheckRound}
              siteKey={turnstileSiteKey}
              onTokenChange={setResendToken}
              statusId="reset-resend-check-status"
              waitingText="Complete the check to send a new code."
            />
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={closeResendCheck}
                disabled={resending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => resendToken && void resend(resendToken)}
                disabled={!resendToken}
                loading={resending}
                aria-describedby="reset-resend-check-status"
              >
                Send new code
              </Button>
            </div>
          </div>
        )}
      </div>
    </form>
  );
}
