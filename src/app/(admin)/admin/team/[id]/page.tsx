import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { getTeamMemberService, TEAM_KIND_LABELS } from '@/modules/research-groups';
import { AdminScreen } from '../../_components/admin-screen';
import { loadMemberProfileData } from '../_components/member-profile-data';
import { MemberProfileSections, memberProfileNav } from '../_components/member-profile-sections';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const result = await getTeamMemberService().findById(id);
  const name = result.ok && result.data ? result.data.name : 'Team member';
  return { title: `Admin — ${name}` };
}

// The full-page form of a member's profile editor, for a direct or pasted link. Inside the admin
// the same editor opens as a popup on /admin/team (`?profile=<id>`).
export default async function AdminTeamMemberPage({ params }: Props) {
  const { id } = await params;
  const memberResult = await getTeamMemberService().findById(id);
  if (!memberResult.ok) throw new Error('Could not load this team member.');
  const member = memberResult.data;
  if (!member) notFound();

  const data = await loadMemberProfileData(member);

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin/team"
        className="inline-flex w-fit items-center gap-1 rounded-xs text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        Back to team
      </Link>
      <AdminScreen
        title={member.name}
        intro={`${member.role} · ${TEAM_KIND_LABELS[member.teamKind]}. What this member's team can have is set by the team, on /admin/team.`}
        sections={memberProfileNav(member, data)}
      >
        <MemberProfileSections member={member} data={data} />
      </AdminScreen>
    </div>
  );
}
