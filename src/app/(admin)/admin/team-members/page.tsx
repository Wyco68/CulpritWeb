import type { Metadata } from 'next';
import { getResearchGroupService, getTeamMemberService, TeamMembersTable } from '@/modules/research-groups';

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Admin — Team Members' };
}

export default async function AdminTeamMembersPage() {
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
