import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getResearchGroupService, getTeamMemberService, TeamMembersTable } from '@/modules/research-groups';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.teamMembers');
  return { title: t('metaTitle') };
}

export default async function AdminTeamMembersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [membersResult, groupsResult] = await Promise.all([
    getTeamMemberService().list(),
    getResearchGroupService().list(),
  ]);

  return (
    <TeamMembersTable
      items={membersResult.ok ? membersResult.data : []}
      groups={groupsResult.ok ? groupsResult.data : []}
    />
  );
}
