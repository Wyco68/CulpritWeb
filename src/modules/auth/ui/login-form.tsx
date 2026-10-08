'use client';

import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/modules/shared/ui/button';
import { Input } from '@/modules/shared/ui/input';
import { FormField } from '@/modules/shared/ui/form-field';
import { signIn, twoFactor } from '../auth-client';
import { loginSchema, type LoginInput } from '../login.schema';
import { authErrorMessage, runAuthRequest } from './auth-error-message';
import { FormAlert } from './form-alert';
import { TwoFactorChallenge } from './two-factor-challenge';

// The single admin's sign-in form. Better Auth's client owns the credential exchange and sets the
// httpOnly session cookie itself; this component only wires the form, maps the server's error to a
// sentence, and redirects on success. The admin layout's server-side `requireAdmin()` check is the
// actual gate — this form is UX, not the security boundary.
//
// Two-step verification is mandatory (ADR-022, ADR-023): a correct password always answers
// `twoFactorRedirect` and no session. The form then requests the first emailed code itself — here,
// in the submit handler, so exactly one send happens per password submit — and swaps to the code
// step in place, without a page load. A password step that answers anything else is unexpected and
// shown as a failure: the server never signs in on a password alone, so this form never treats one
// as a sign-in.
//
// Every auth form that takes a secret is `method="post"`. Once hydrated, `handleSubmit` prevents
// the native submit; before that (slow network, a script error, a fast typist), the browser would
// otherwise send a GET with the password or code in the URL — and so in history and proxy logs.

export interface LoginFormProps {
  /**
   * Where codes are emailed, already masked (ADMIN_EMAIL_MASKED), for the code step's copy. Passed
   * from the Server Component page so the full address never reaches the browser bundle.
   */
  maskedEmail: string;
}

type Challenge = { sendError: string | null };

const SIGN_IN_FAILED = 'Could not sign in. Check your credentials and try again.';
/** The password step answered without a two-step challenge, which the server never does. */
const UNEXPECTED_RESPONSE = "Sign-in couldn't be completed. Please try again.";

export function LoginForm({ maskedEmail }: LoginFormProps) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  // Set when the code step hands back to this one, so focus returns to the password field.
  const returningFromChallenge = useRef(false);

  const {
    register,
    handleSubmit,
    setFocus,
    resetField,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  useEffect(() => {
    if (challenge || !returningFromChallenge.current) return;
    returningFromChallenge.current = false;
    setFocus('password');
  }, [challenge, setFocus]);

  function finishSignIn() {
    setRedirecting(true);
    toast.success('Signed in.');
    router.push('/admin');
    router.refresh();
  }

  async function onSubmit(values: LoginInput) {
    setFormError(null);
    const { data, error } = await runAuthRequest(() =>
      signIn.email({ email: values.email, password: values.password }),
    );

    if (error) return fail(authErrorMessage(error, SIGN_IN_FAILED));

    // Not in the client's type: the two-factor plugin answers this in place of a session.
    if (!('twoFactorRedirect' in data) || data.twoFactorRedirect !== true) {
      return fail(UNEXPECTED_RESPONSE);
    }

    const sent = await runAuthRequest(() => twoFactor.sendOtp());
    setChallenge({
      sendError: sent.error
        ? authErrorMessage(sent.error, "We couldn't send the code. Use “Resend code” to try again.")
        : null,
    });
  }

  function fail(message: string) {
    setFormError(message);
    toast.error(message);
  }

  function restart(reason: string | null) {
    returningFromChallenge.current = true;
    resetField('password');
    setFormError(reason);
    setChallenge(null);
  }

  if (challenge) {
    return (
      <TwoFactorChallenge
        maskedEmail={maskedEmail}
        initialSendError={challenge.sendError}
        onVerified={finishSignIn}
        onRestart={restart}
      />
    );
  }

  return (
    <form
      method="post"
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-5"
    >
      {formError && <FormAlert>{formError}</FormAlert>}

      <FormField label="Email" htmlFor="email" error={errors.email?.message} required>
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

      <div className="flex flex-col gap-2">
        <FormField label="Password" htmlFor="password" error={errors.password?.message} required>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              {...register('password')}
              type="password"
              autoComplete="current-password"
            />
          )}
        </FormField>
        <Link
          href="/login/forgot-password"
          className="focus-ring self-end rounded-sm text-sm font-medium text-accent underline-offset-4 hover:underline"
        >
          Forgot password?
        </Link>
      </div>

      <Button type="submit" size="lg" loading={isSubmitting || redirecting} className="mt-1">
        Sign in
      </Button>
    </form>
  );
}
