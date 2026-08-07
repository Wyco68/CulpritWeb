import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Avatar } from '@/modules/shared/ui/avatar';
import type { Profile } from '@/modules/profile';
import { NavTabs } from './nav-tabs';

// The fixed navy hero band, reproduced from the Figma "Admin Dashboard with Tabs" prototype's
// visual language: circular photo, uppercase eyebrow, large name heading, subtitle, tab bar with
// an accent underline — all inside one constant navy surface (see the `--navy` token). Rendered
// once by the (public) layout so it's shared across every tab instead of duplicated per page.
// The professor's name is the page's single <h1> for the whole site shell; each tab's own
// heading below is an <h2>.
export async function SiteHeader({ profile }: { profile: Profile | null }) {
  const t = await getTranslations('nav');

  const fullName = profile?.fullName || t('fallbackName');
  const initials = fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (
    <header className="bg-navy text-navy-foreground">
      <div className="mx-auto max-w-5xl px-6 pt-10 sm:pt-14">
        <div className="flex items-start gap-4">
          <Link
            href="/"
            className="inline-flex flex-col gap-4 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent sm:flex-row sm:items-center sm:gap-6"
          >
            <Avatar
              src={profile?.photoUrl}
              alt={t('photoAlt', { name: fullName })}
              fallback={initials || '?'}
              size="lg"
            />
            <div>
              {profile?.title && (
                <p className="font-mono text-xs uppercase tracking-widest text-accent sm:text-sm">
                  {profile.title}
                </p>
              )}
              <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-4xl">
                {fullName}
              </h1>
              {profile?.positionAffiliation && (
                <p className="mt-1 max-w-xl text-sm text-navy-foreground/70 sm:text-base">
                  {profile.positionAffiliation}
                </p>
              )}
            </div>
          </Link>
        </div>

        <div className="mt-8 border-t border-navy-foreground/10 sm:mt-10">
          <NavTabs />
        </div>
      </div>
    </header>
  );
}
