import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getSettingsService, SettingsForm, SETTINGS_DEFAULTS } from '@/modules/settings';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.settings');
  return { title: t('metaTitle') };
}

// No admin GET /api/admin/settings route exists (only PUT) — this Server Component reads the
// current values directly through the settings service, same "server components fetch directly
// through services" pattern used by every other admin page's initial load.
export default async function AdminSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('admin.settings');

  const result = await getSettingsService().getSettings();
  const settings = result.ok ? result.data : SETTINGS_DEFAULTS;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>
      <SettingsForm settings={settings} />
    </div>
  );
}
