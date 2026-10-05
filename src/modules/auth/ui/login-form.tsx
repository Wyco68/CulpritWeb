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
// With two-step verification on (ADR-022) a correct password answers `twoFactorRedirect` and no
// session. The form then requests the first emailed code itself — here, in the submit handler, so
// exactly one send happens per password submit — and swaps to the code step in place, without a
// page load, keeping the email for the step's copy.

type Challenge = { email: string; sendError: string | null };

const SIGN_IN_FAILED = 'Could not sign in. Check your credentials and try again.';

export function LoginForm() {
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

    if (error) {
      const message = authErrorMessage(error, SIGN_IN_FAILED);
      setFormError(message);
      toast.error(message);
      return;
    }

    // Not in the client's type: the two-factor plugin answers this in place of a session.
    if ('twoFactorRedirect' in data && data.twoFactorRedirect) {
      const sent = await runAuthRequest(() => twoFactor.sendOtp());
      setChallenge({
        email: values.email,
        sendError: sent.error
          ? authErrorMessage(
              sent.error,
              "We couldn't send the code. Use “Resend code” to try again.",
            )
          : null,
      });
      return;
    }

    finishSignIn();
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
        email={challenge.email}
        initialSendError={challenge.sendError}
        onVerified={finishSignIn}
        onRestart={restart}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
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
