import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getProfileService, ProfileForm } from '@/modules/profile';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.profile');
  return { title: t('metaTitle') };
}

// "Set Information — Profile" (PROJECT_SPEC §9.2). Server Component reads the current singleton
// directly through the profile service (same pattern the public About page uses); the interactive
// form + PUT mutation live in the client island below.
export default async function AdminProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('admin.profile');

  const result = await getProfileService().getProfile();
  const profile = result.ok ? result.data : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>
      <ProfileForm profile={profile} />
    </div>
  );
}
