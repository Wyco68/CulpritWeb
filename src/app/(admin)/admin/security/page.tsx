import type { Metadata } from 'next';
import { ADMIN_EMAIL_MASKED, TwoFactorSettings } from '@/modules/auth';
import { isEmailDeliveryConfigured } from '@/modules/integrations';
import { AdminScreen } from '../_components/admin-screen';

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Admin — Security' };
}

// How the admin signs in: mandatory two-step verification by emailed code, and its backup codes
// (ADR-022, ADR-023). The admin layout's requireAdmin() has already gated this page. Whether the
// server can send email is read here, on the server; only the masked mailbox is passed to the
// client, so the full address never reaches the browser bundle.
export default function AdminSecurityPage() {
  return (
    <AdminScreen title="Security" intro="How you sign in to the admin.">
      <TwoFactorSettings
        maskedEmail={ADMIN_EMAIL_MASKED}
        emailConfigured={isEmailDeliveryConfigured()}
      />
    </AdminScreen>
  );
}
