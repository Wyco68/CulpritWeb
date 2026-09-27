import type { Metadata } from 'next';
import { getProfileCached, ProfileFieldsForm } from '@/modules/profile';
import { getTeamMemberService, getTeamService, TeamsAdmin } from '@/modules/research-groups';
import { AdminScreen } from '../_components/admin-screen';
import { loadMemberProfilesData } from './_components/member-profile-data';
import { TeamMembersAdmin } from './_components/team-members-admin';

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Admin — Team' };
}

// Mirrors the public Team tab: the intro, then the members. Each member's CV lists, courses and
// projects open in a popup from the row's "Edit profile".
const SECTIONS = [
  { id: 'intro', label: 'Introduction' },
  { id: 'teams', label: 'Teams' },
  { id: 'members', label: 'Team members' },
] as const;

const PROFILE_SECTIONS = [
  {
    id: 'intro',
    title: 'Introduction',
    description: 'Optional prose above the member list on the public tab.',
    fields: ['teamIntro'],
  },
] as const;

export default async function AdminTeamPage() {
  const service = getTeamMemberService();
  const [profileResult, membersResult, teamsResult] = await Promise.all([
    getProfileCached(),
    service.list(),
    getTeamService().list(),
  ]);
  const members = membersResult.ok ? membersResult.data : [];
  const teams = teamsResult.ok ? teamsResult.data : [];

  // The member dialog edits the whole link list and the profile popup opens already filled, so both
  // are read up front for every member — batched, so the query count stays flat as the lab grows.
  const ids = members.map((member) => member.id);
  const [linksResult, profiles] = await Promise.all([
    service.listLinksForMembers(ids),
    loadMemberProfilesData(members),
  ]);
  const linksByMember = linksResult.ok ? linksResult.data : {};

  return (
    <AdminScreen title="Team" intro="Everything on the public Team tab." sections={SECTIONS}>
      <ProfileFieldsForm
        profile={profileResult.ok ? profileResult.data : null}
        sections={PROFILE_SECTIONS}
      />
      <TeamsAdmin teams={teams} />
      <TeamMembersAdmin
        members={members}
        teams={teams.map(({ id, name, sortOrder }) => ({ id, name, sortOrder }))}
        linksByMember={linksByMember}
        profiles={profiles}
      />
    </AdminScreen>
  );
}
