import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireAdmin, TwoFactorSettings } from '@/modules/auth';
import { isEmailDeliveryConfigured } from '@/modules/integrations';
import { AdminScreen } from '../_components/admin-screen';

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Admin — Security' };
}

// How the admin signs in: two-step verification by emailed code and its backup codes (ADR-022).
// The state is read here, on the server, from the same session check the layout makes; the client
// settings only ever refresh this page after a change, never hold their own copy of it.
export default async function AdminSecurityPage() {
  const session = await requireAdmin();
  // The layout has already redirected a visitor without a session; this narrows the type.
  if (!session.ok) redirect('/login');

  return (
    <AdminScreen title="Security" intro="How you sign in to the admin.">
      <TwoFactorSettings
        enabled={session.data.twoFactorEnabled}
        emailConfigured={isEmailDeliveryConfigured()}
        email={session.data.email}
      />
    </AdminScreen>
  );
}
