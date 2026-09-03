import type { Metadata } from 'next';
import { getProfileCached, ProfileFieldsForm } from '@/modules/profile';
import {
  getResearchGroupService,
  getTeamMemberService,
  ResearchGroupsTable,
  TeamMembersTable,
} from '@/modules/research-groups';
import { AdminScreen } from '../_components/admin-screen';

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Admin — Team' };
}

// Mirrors the public Team Members tab, which renders groups and the people in them as one page.
// The admin side used to split that across /admin/groups and /admin/team-members, so assigning a
// person to a group meant holding the group list in your head on a different screen. A member's
// group is a select on the member form, and its options are the rows in the table directly above.
const SECTIONS = [
  { id: 'intro', label: 'Introduction' },
  { id: 'groups', label: 'Research groups' },
  { id: 'members', label: 'Team members' },
] as const;

const PROFILE_SECTIONS = [
  {
    id: 'intro',
    title: 'Introduction',
    description: 'Optional prose above the research groups on the public tab.',
    fields: ['teamIntro'],
  },
] as const;

export default async function AdminTeamPage() {
  // Two complementary reads, not overlapping ones. This screen lists the people once, in the
  // members table; the groups table shows each group's size. Asking for groups with their members
  // attached (what the public tab needs, because it renders them) fetched the entire member table
  // a second time purely to call `.length` on it — so the groups arrive with a count instead.
  const [profileResult, groupsResult, membersResult] = await Promise.all([
    getProfileCached(),
    getResearchGroupService().listWithMemberCounts(),
    getTeamMemberService().list(),
  ]);

  const groups = groupsResult.ok ? groupsResult.data : [];
  // One read of the member table, shared by both tables and by the group dialog's roster editor.
  const members = membersResult.ok ? membersResult.data : [];

  return (
    <AdminScreen
      title="Team"
      intro="Everything on the public Team Members tab."
      sections={SECTIONS}
    >
      <ProfileFieldsForm
        profile={profileResult.ok ? profileResult.data : null}
        sections={PROFILE_SECTIONS}
      />
      <ResearchGroupsTable items={groups} members={members} />
      <TeamMembersTable items={members} groups={groups} />
    </AdminScreen>
  );
}
