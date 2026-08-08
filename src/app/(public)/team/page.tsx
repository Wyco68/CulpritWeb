import type { Metadata } from 'next';
import { Users } from 'lucide-react';
import {
  getResearchGroupService,
  getTeamMemberService,
  TeamMembersView,
} from '@/modules/research-groups';
import { EmptyState } from '@/modules/shared/ui/empty-state';

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
      <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Team Members</h2>

      {(!groupsResult.ok && !ungroupedResult.ok) || !hasAnyone ? (
        <EmptyState
          icon={Users}
          title="No team members listed yet"
          description="Please check back soon."
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
