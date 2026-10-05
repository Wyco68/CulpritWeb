import type { Metadata } from 'next';
import { KeyRound } from 'lucide-react';
import { ADMIN_EMAIL_MASKED, ForgotPasswordForm } from '@/modules/auth';
import { publicEnv } from '@/modules/shared/lib/env';
import { AuthCardShell } from '../_components/auth-card-shell';

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Reset Password' };
}

// "Forgot password" by emailed code (ADR-022, ADR-023). Under /login, outside the guarded /admin layout, so
// it is reachable signed out. Deliberately not redirected when signed in: there is no
// change-password screen, so this is also how a signed-in admin replaces a password. A completed
// reset signs out every session, this one included. The code request is behind Turnstile; with no
// site key configured the form shows no check (and the server skips it outside production). The
// code always goes to the admin mailbox; only its masked form is passed to the client.
export default function ForgotPasswordPage() {
  return (
    <AuthCardShell
      title="Reset Password"
      description="Choose a new password with a code from the admin mailbox."
      icon={KeyRound}
      backHref="/login"
      backLabel="Back to sign in"
    >
      <ForgotPasswordForm
        maskedEmail={ADMIN_EMAIL_MASKED}
        turnstileSiteKey={publicEnv.turnstileSiteKey || undefined}
      />
    </AuthCardShell>
  );
}
