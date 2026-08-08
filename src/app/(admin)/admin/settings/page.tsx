import type { Metadata } from 'next';
import { getSettingsService, SettingsForm, SETTINGS_DEFAULTS } from '@/modules/settings';

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Admin — Settings' };
}

// No admin GET /api/admin/settings route exists (only PUT) — this Server Component reads the
// current values directly through the settings service, same "server components fetch directly
// through services" pattern used by every other admin page's initial load.
export default async function AdminSettingsPage() {
  const result = await getSettingsService().getSettings();
  const settings = result.ok ? result.data : SETTINGS_DEFAULTS;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Control site-wide visibility.</p>
      </div>
      <SettingsForm settings={settings} />
    </div>
  );
}
