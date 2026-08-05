import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { UserRound } from 'lucide-react';
import { getProfileService, ProfileAffiliations } from '@/modules/profile';
import { EmptyState } from '@/modules/shared/ui/empty-state';

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'about' });
  return { title: t('metaTitle'), description: t('metaDescription') };
}

export default async function AboutPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('about');

  const result = await getProfileService().getProfile();

  return (
    <div>
      <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{t('title')}</h2>

      {!result.ok || !result.data ? (
        <EmptyState
          icon={UserRound}
          title={t('emptyTitle')}
          description={t('emptyBody')}
          className="mt-6"
        />
      ) : (
        <div className="mt-6 space-y-10">
          {result.data.bio && (
            <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
              {result.data.bio}
            </p>
          )}

          {result.data.researchStatement && (
            <section aria-labelledby="research-statement-heading">
              <h3
                id="research-statement-heading"
                className="text-sm font-semibold tracking-tight text-foreground"
              >
                {t('fields.researchStatement')}
              </h3>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {result.data.researchStatement}
              </p>
            </section>
          )}

          <ProfileAffiliations profile={result.data} />
        </div>
      )}
    </div>
  );
}
