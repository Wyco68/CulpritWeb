import type { Metadata } from 'next';
import {
  getResearchGroupService,
  getTeamMemberService,
  TeamMembersView,
} from '@/modules/research-groups';
import { EmptyState } from '@/modules/shared/ui/empty-state';
import { PageHeading } from '@/modules/shared/ui/page-heading';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Team Members',
    description: 'Research groups, researchers, and visiting professors.',
  };
}

export default async function TeamPage() {
  // Two complementary reads, not overlapping ones: groups arrive with their own members attached,
  // so the second call asks only for the members that belong to no group. Listing every member
  // here and filtering in memory would fetch the grouped ones a second time over the wire.
  const [groupsResult, ungroupedResult] = await Promise.all([
    getResearchGroupService().list(),
    getTeamMemberService().list({ ungroupedOnly: true }),
  ]);

  const groups = groupsResult.ok ? groupsResult.data : [];
  const ungrouped = ungroupedResult.ok ? ungroupedResult.data : [];
  const hasAnyone = groups.some((group) => group.teamMembers.length > 0) || ungrouped.length > 0;

  return (
    <div>
      <PageHeading title="Team Members" />

      {(!groupsResult.ok && !ungroupedResult.ok) || !hasAnyone ? (
        <EmptyState title="No team members listed yet" className="mt-10" />
      ) : (
        <div className="mt-12">
          <TeamMembersView groups={groups} ungrouped={ungrouped} />
        </div>
      )}
    </div>
  );
}
