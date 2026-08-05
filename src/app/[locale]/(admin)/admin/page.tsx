import type { Metadata } from 'next';
import { FileText, FlaskConical, Users2, Building2, Clock3, CalendarClock } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/modules/shared/ui/card';
import { getResearchService } from '@/modules/research';
import { getPublicationService } from '@/modules/publications';
import { getResearchGroupService, getTeamMemberService } from '@/modules/research-groups';
import { getAppointmentService } from '@/modules/appointments';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.dashboard');
  return { title: t('metaTitle') };
}

const QUICK_LINKS = [
  { href: '/admin/profile', key: 'profile' },
  { href: '/admin/research', key: 'research' },
  { href: '/admin/publications', key: 'publications' },
  { href: '/admin/groups', key: 'groups' },
  { href: '/admin/team-members', key: 'teamMembers' },
  { href: '/admin/appointments', key: 'appointments' },
  { href: '/admin/settings', key: 'settings' },
] as const;

// The dashboard is deliberately light: at-a-glance counts (fetched directly through each
// module's service — a Server Component read, no client round trip needed) plus quick links into
// every "Set Information" / "Manage Appointments" section. Nothing here is itself editable.
export default async function AdminDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('admin.dashboard');
  const tNav = await getTranslations('admin.nav');

  const [research, publications, groups, teamMembers, pending, upcoming] = await Promise.all([
    getResearchService().list(),
    getPublicationService().list(),
    getResearchGroupService().list(),
    getTeamMemberService().list(),
    getAppointmentService().list({ status: 'pending' }),
    getAppointmentService().list({}),
  ]);

  const upcomingCount = upcoming.ok
    ? upcoming.data.filter((a) => a.status === 'approved' || a.status === 'booked').length
    : 0;

  const stats = [
    { key: 'researchCount', icon: FlaskConical, value: research.ok ? research.data.length : 0 },
    {
      key: 'publicationsCount',
      icon: FileText,
      value: publications.ok ? publications.data.length : 0,
    },
    { key: 'groupsCount', icon: Building2, value: groups.ok ? groups.data.length : 0 },
    { key: 'teamMembersCount', icon: Users2, value: teamMembers.ok ? teamMembers.data.length : 0 },
    { key: 'pendingCount', icon: Clock3, value: pending.ok ? pending.data.length : 0 },
    { key: 'upcomingCount', icon: CalendarClock, value: upcomingCount },
  ] as const;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map(({ key, icon: Icon, value }) => (
          <Card key={key}>
            <CardContent className="flex flex-col gap-2 p-4">
              <Icon className="size-4 text-accent" aria-hidden="true" />
              <p className="text-2xl font-semibold tracking-tight text-foreground">{value}</p>
              <p className="text-xs text-muted-foreground">{t(key)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <section aria-labelledby="quick-links-heading">
        <h2 id="quick-links-heading" className="mb-3 text-base font-semibold text-foreground">
          {t('quickLinksTitle')}
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_LINKS.map(({ href, key }) => (
            <Link key={href} href={href} className="block">
              <Card className="h-full transition-colors hover:border-accent/50 hover:bg-muted/40">
                <CardHeader>
                  <CardTitle className="text-sm">{tNav(key)}</CardTitle>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
