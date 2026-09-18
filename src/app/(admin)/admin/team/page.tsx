import type { Metadata } from 'next';
import { getProfileCached, ProfileFieldsForm } from '@/modules/profile';
import { getTeamMemberService } from '@/modules/research-groups';
import { AdminScreen } from '../_components/admin-screen';
import { loadMemberProfileData } from './_components/member-profile-data';
import { TeamMembersAdmin } from './_components/team-members-admin';

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Admin — Team' };
}

// Mirrors the public Team tab: the intro, then the members. Each member's CV lists, courses and
// projects open in a popup from the row's "Edit profile".
const SECTIONS = [
  { id: 'intro', label: 'Introduction' },
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
  const [profileResult, membersResult] = await Promise.all([getProfileCached(), service.list()]);
  const members = membersResult.ok ? membersResult.data : [];

  // The member dialog edits the whole link list, so it needs the stored rows up front. One small
  // read per member: the lab is a handful of people, and this is an admin screen with no cache to
  // protect — a join would be the repository's call to make, not this page's.
  const links = await Promise.all(
    members.map(async (member) => {
      const result = await service.listLinks(member.id);
      return [member.id, result.ok ? result.data : []] as const;
    }),
  );
  // Every member's profile lists, read up front so the popup opens already filled.
  // ponytail: three small reads per member — fine for a lab of tens of people; fetch on open if
  // the team grows past that.
  const profiles = await Promise.all(
    members.map(async (member) => [member.id, await loadMemberProfileData(member)] as const),
  );

  return (
    <AdminScreen title="Team" intro="Everything on the public Team tab." sections={SECTIONS}>
      <ProfileFieldsForm
        profile={profileResult.ok ? profileResult.data : null}
        sections={PROFILE_SECTIONS}
      />
      <TeamMembersAdmin
        members={members}
        linksByMember={Object.fromEntries(links)}
        profiles={Object.fromEntries(profiles)}
      />
    </AdminScreen>
  );
}
