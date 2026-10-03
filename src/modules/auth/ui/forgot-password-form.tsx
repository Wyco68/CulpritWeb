'use client';

import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/modules/shared/ui/button';
import { Input } from '@/modules/shared/ui/input';
import { FormField } from '@/modules/shared/ui/form-field';
import { emailOtp } from '../auth-client';
import { CAPTCHA_HEADER, CODE_DIGITS, CODE_TTL_MINUTES, PASSWORD_POLICY } from '../auth-policy';
import {
  requestPasswordResetSchema,
  resetPasswordSchema,
  type RequestPasswordResetInput,
} from '../password-reset.schema';
import {
  authErrorMessage,
  parseRetryAfter,
  resetRequestErrorMessage,
  runAuthRequest,
  type AuthClientError,
} from './auth-error-message';
import { CodeField } from './code-field';
import { FormAlert, FormNotice } from './form-alert';
import { HumanCheck } from './human-check';
import { ResendCodeButton } from './resend-code-button';
import { useResendCooldown } from './use-resend-cooldown';

// "Forgot password" by emailed 8-digit code (ADR-022), in two steps on one page: ask for a code,
// then enter it with the new password.
//
// The server answers a request the same way whether or not the address is the admin's, and the
// copy here does too — "if that email belongs to the admin" — so the page can't be used to find
// out which address is. Only a failure that has nothing to do with the address (human check, rate
// limit, server, connection) keeps the visitor on the first step.
//
// Every code request — the first and each "Resend code" — carries a fresh Cloudflare Turnstile
// token in the `x-captcha-response` header. Tokens are single-use, so the check is started over
// after every attempt, whatever its outcome. With no site key configured the check is skipped, as
// the server skips it too outside production.
//
// A completed reset signs out every session and does not sign in. The admin is sent to /login and
// signs in with the new password, passing two-step verification if it is on.

/** Human-check failures: about the request, never about the address. */
const CAPTCHA_ERROR_CODES = new Set([
  'MISSING_RESPONSE',
  'VERIFICATION_FAILED',
  'UNKNOWN_ERROR',
  'CAPTCHA_NOT_CONFIGURED',
]);

/** Errors that are about the request itself, not the address — the only ones a request reports. */
export function isRequestFailure(error: AuthClientError): boolean {
  if (error.code && CAPTCHA_ERROR_CODES.has(error.code)) return true;
  return error.status === 429 || error.status === undefined || (error.status ?? 0) >= 500;
}

/**
 * One code request. A 429 here may be the per-IP limit or a site-wide cap lasting up to a day, so
 * the response's `Retry-After` is read (through the client's `onError` hook — the only place it
 * exposes the response) and carried on the error for the message.
 */
async function requestResetCode(email: string, captchaToken: string | null) {
  let retryAfterSeconds: number | undefined;
  const result = await runAuthRequest(() =>
    emailOtp.requestPasswordReset(
      { email },
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
  /** NEXT_PUBLIC_TURNSTILE_SITE_KEY. Absent: no human check is shown. */
  turnstileSiteKey?: string;
}

export function ForgotPasswordForm({ turnstileSiteKey }: ForgotPasswordFormProps) {
  const [email, setEmail] = useState<string | null>(null);
  // The first step takes focus only when the admin comes back to it, not on page load, so a screen
  // reader still starts at the page's heading.
  const [returned, setReturned] = useState(false);

  if (email === null) {
    return (
      <RequestCodeStep
        onRequested={setEmail}
        focusOnMount={returned}
        turnstileSiteKey={turnstileSiteKey}
      />
    );
  }
  return (
    <ResetPasswordStep
      email={email}
      turnstileSiteKey={turnstileSiteKey}
      onChangeEmail={() => {
        setReturned(true);
        setEmail(null);
      }}
    />
  );
}

type RequestOutput = z.output<typeof requestPasswordResetSchema>;

function RequestCodeStep({
  onRequested,
  focusOnMount,
  turnstileSiteKey,
}: {
  onRequested: (email: string) => void;
  focusOnMount: boolean;
  turnstileSiteKey?: string;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  // Bumped after every attempt: remounts the check, since the token it gave is now spent.
  const [captchaRound, setCaptchaRound] = useState(0);
  const needsCheck = Boolean(turnstileSiteKey);
  const checkStatusId = 'reset-human-check-status';

  const {
    register,
    handleSubmit,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<RequestPasswordResetInput, unknown, RequestOutput>({
    resolver: zodResolver(requestPasswordResetSchema),
  });

  useEffect(() => {
    if (focusOnMount) setFocus('email');
  }, [focusOnMount, setFocus]);

  async function onSubmit({ email }: RequestOutput) {
    if (needsCheck && !captchaToken) return;
    setFormError(null);
    const token = captchaToken;
    setCaptchaToken(null);
    setCaptchaRound((round) => round + 1);

    const { error } = await requestResetCode(email, token);
    if (error && isRequestFailure(error)) {
      setFormError(resetRequestErrorMessage(error, "Couldn't request a code. Please try again."));
      return;
    }
    onRequested(email);
  }

  const waiting = needsCheck && !captchaToken;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      {formError && <FormAlert>{formError}</FormAlert>}

      <FormField
        label="Email"
        htmlFor="reset-email"
        description={`We'll email an ${CODE_DIGITS}-digit code to the admin address.`}
        error={errors.email?.message}
        required
      >
        {(fieldProps) => (
          <Input
            {...fieldProps}
            {...register('email')}
            type="email"
            autoComplete="username"
            placeholder="you@example.com"
          />
        )}
      </FormField>

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
        loading={isSubmitting}
        disabled={waiting}
        aria-describedby={needsCheck ? checkStatusId : undefined}
        className="mt-1"
      >
        Send code
      </Button>
    </form>
  );
}

type ResetInput = z.input<typeof resetPasswordSchema>;
type ResetOutput = z.output<typeof resetPasswordSchema>;

function ResetPasswordStep({
  email,
  onChangeEmail,
  turnstileSiteKey,
}: {
  email: string;
  onChangeEmail: () => void;
  turnstileSiteKey?: string;
}) {
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
    defaultValues: { email, otp: '', password: '', confirmPassword: '' },
  });

  // Entering this step lands on the code field; its description carries the uniform message.
  useEffect(() => {
    setFocus('otp');
  }, [setFocus]);

  // The check takes focus when it opens, so a keyboard or screen-reader user is taken to it.
  useEffect(() => {
    if (resendCheckOpen) resendCheckRef.current?.focus();
  }, [resendCheckOpen]);

  async function onSubmit(values: ResetOutput) {
    setFormError(null);
    // `confirmPassword` is the form's own check and never leaves the browser.
    const { error } = await runAuthRequest(() =>
      emailOtp.resetPassword({ email: values.email, otp: values.otp, password: values.password }),
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
    const { error } = await requestResetCode(email, captchaToken);
    setResending(false);
    if (error && isRequestFailure(error)) {
      setNotice(null);
      setFormError(
        resetRequestErrorMessage(error, "Couldn't request a new code. Please try again."),
      );
      return;
    }
    setResendCheckOpen(false);
    setResendToken(null);
    cooldown.start();
    setNotice('If that email belongs to the admin, a new code is on its way.');
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

      {/* Read-only, but a real field: it names the account for a password manager saving the new
          password, and keeps the address visible while the admin finds the email. */}
      <FormField label="Email" htmlFor="reset-email-sent">
        {(fieldProps) => (
          <Input
            {...fieldProps}
            {...register('email')}
            type="email"
            autoComplete="username"
            readOnly
            className="bg-muted"
          />
        )}
      </FormField>

      <CodeField
        id="reset-code"
        registration={register('otp')}
        error={errors.otp?.message}
        description={`If that email belongs to the admin, a code is on its way. It expires ${CODE_TTL_MINUTES} minutes after it was sent.`}
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onChangeEmail} disabled={busy}>
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Use a different email
          </Button>
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
