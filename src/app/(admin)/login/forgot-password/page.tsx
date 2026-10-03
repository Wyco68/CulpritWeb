import type { Metadata } from 'next';
import { KeyRound } from 'lucide-react';
import { ForgotPasswordForm } from '@/modules/auth';
import { publicEnv } from '@/modules/shared/lib/env';
import { AuthCardShell } from '../_components/auth-card-shell';

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Reset Password' };
}

// "Forgot password" by emailed code (ADR-022). Under /login, outside the guarded /admin layout, so
// it is reachable signed out. Deliberately not redirected when signed in: there is no
// change-password screen, so this is also how a signed-in admin replaces a password. A completed
// reset signs out every session, this one included. The code request is behind Turnstile; with no
// site key configured the form shows no check (and the server skips it outside production).
export default function ForgotPasswordPage() {
  return (
    <AuthCardShell
      title="Reset Password"
      description="We'll email you a code to choose a new password."
      icon={KeyRound}
      backHref="/login"
      backLabel="Back to sign in"
    >
      <ForgotPasswordForm turnstileSiteKey={publicEnv.turnstileSiteKey || undefined} />
    </AuthCardShell>
  );
}
