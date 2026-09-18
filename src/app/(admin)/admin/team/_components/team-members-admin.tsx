'use client';

import { useCallback, useState } from 'react';
import { TeamMembersTable } from '@/modules/research-groups/ui/team-members-table';
import type { MemberLink, TeamMember } from '@/modules/research-groups/team-member.types';
import { TEAM_KIND_LABELS } from '@/modules/shared/lib/team-kind';
import { useOpenFromQuery } from '@/modules/shared/lib/use-edit-from-query';
import { Dialog } from '@/modules/shared/ui/dialog';
import type { MemberProfileData } from './member-profile-data';
import { MemberProfileSections } from './member-profile-sections';

// The Team screen's member list plus the profile popup. "Edit profile" opens a member's CV lists,
// courses and projects over the list instead of navigating away; the dashboard links here with
// `?profile=<id>` to open it directly. Every list inside refreshes the page after a change, so the
// popup stays open on fresh data.

const EMPTY_PROFILE: MemberProfileData = { cvEntries: [], courses: [], projects: [] };

export function TeamMembersAdmin({
  members,
  linksByMember,
  profiles,
}: {
  members: TeamMember[];
  linksByMember: Record<string, MemberLink[]>;
  profiles: Record<string, MemberProfileData>;
}) {
  const [profileId, setProfileId] = useState<string | null>(null);
  const member = members.find((candidate) => candidate.id === profileId);
  const openProfile = useCallback((target: TeamMember) => setProfileId(target.id), []);

  useOpenFromQuery('profile', members, openProfile);

  return (
    <>
      <TeamMembersTable items={members} linksByMember={linksByMember} onEditProfile={openProfile} />
      <Dialog
        open={Boolean(member)}
        onOpenChange={(open) => {
          if (!open) setProfileId(null);
        }}
        title={member ? `Edit profile: ${member.name}` : 'Edit profile'}
        description={member ? `${member.role} · ${TEAM_KIND_LABELS[member.teamKind]}` : undefined}
        className="dialog-enter max-w-4xl"
      >
        {member && (
          <div className="flex flex-col gap-8">
            <MemberProfileSections member={member} data={profiles[member.id] ?? EMPTY_PROFILE} />
          </div>
        )}
      </Dialog>
    </>
  );
}
