import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Users } from 'lucide-react';
import {
  getResearchGroupService,
  getTeamMemberService,
  TeamMembersView,
} from '@/modules/research-groups';
import { EmptyState } from '@/modules/shared/ui/empty-state';

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'team' });
  return { title: t('metaTitle'), description: t('metaDescription') };
}

export default async function TeamPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('team');

  const [groupsResult, membersResult] = await Promise.all([
    getResearchGroupService().list(),
    getTeamMemberService().list(),
  ]);

  const groups = groupsResult.ok ? groupsResult.data : [];
  const members = membersResult.ok ? membersResult.data : [];
  const ungrouped = members.filter((member) => member.researchGroupId === null);
  const hasAnyone = groups.some((group) => group.teamMembers.length > 0) || ungrouped.length > 0;

  return (
    <div>
      <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{t('title')}</h2>

      {(!groupsResult.ok && !membersResult.ok) || !hasAnyone ? (
        <EmptyState
          icon={Users}
          title={t('emptyTitle')}
          description={t('emptyBody')}
          className="mt-6"
        />
      ) : (
        <div className="mt-6">
          <TeamMembersView groups={groups} ungrouped={ungrouped} />
        </div>
      )}
    </div>
  );
}
