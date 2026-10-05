import type { Metadata } from 'next';
import { ShieldCheck } from 'lucide-react';
import { redirect } from 'next/navigation';
import { ADMIN_EMAIL_MASKED, LoginForm, requireAdmin } from '@/modules/auth';
import { AuthCardShell } from './_components/auth-card-shell';

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Admin Login' };
}

// The admin sign-in page. `(admin)` route group + this page's own segment resolve to the bare
// `/login` path (sibling to `/admin`, not nested under it) so an unauthenticated visitor never
// passes through the guarded admin layout to reach it. Already-authenticated admins are bounced
// straight to the dashboard — no point showing a login form to someone with a live session.
//
// Every sign-in asks for an emailed code after the password (ADR-023); the form's code step replaces
// the password step inside this same card, with no separate page. The masked mailbox is passed from
// here, on the server, so the full address never reaches the browser bundle.
export default async function LoginPage() {
  const session = await requireAdmin();
  if (session.ok) redirect('/admin');

  return (
    <AuthCardShell
      title="Admin Login"
      description="Manage the content of The Culprit."
      icon={ShieldCheck}
      backHref="/"
      backLabel="Back to the site"
    >
      <LoginForm maskedEmail={ADMIN_EMAIL_MASKED} />
    </AuthCardShell>
  );
}
