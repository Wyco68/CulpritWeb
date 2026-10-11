'use client';

import { useState } from 'react';
import { IdCard, ImageOff, Pencil, Plus, Trash2, Users2 } from 'lucide-react';
import { Avatar } from '@/modules/shared/ui/avatar';
import { useDeleteRecord } from '@/modules/shared/lib/use-delete-record';
import { useEditFromQuery } from '@/modules/shared/lib/use-edit-from-query';
import { Button } from '@/modules/shared/ui/button';
import { FormSection, FormSectionCount } from '@/modules/shared/ui/form-section';
import { ConfirmDialog } from '@/modules/shared/ui/confirm-dialog';
import { RecordIdentity, RecordTable } from '@/modules/shared/ui/record-table';
// Deep imports, not the barrel — see team-member-form-dialog.tsx's comment.
import type { MemberLink, TeamMember } from '../team-member.types';
import type { TeamRef } from '../team.types';
import { TeamMemberFormDialog } from './team-member-form-dialog';
import { memberInitials } from './member-card';

/** Where a member sits on the Team tab: the director on their own, else their team, else none. */
const DIRECTOR = 'director';
const NO_TEAM = 'none';
const placeOf = (member: TeamMember) =>
  member.isDirector ? DIRECTOR : (member.team?.id ?? NO_TEAM);

export function TeamMembersTable({
  items,
  teams,
  linksByMember = {},
  onEditProfile,
}: {
  items: TeamMember[];
  /** The admin's teams, in display order — the filter options and the form's team picker. */
  teams: readonly TeamRef[];
  /**
   * Each member's external links, keyed by member id, so the edit dialog opens with the list the
   * admin is about to change. Read on the server with the members themselves — the alternative,
   * fetching them when the dialog opens, would mean a second round trip and a spinner inside a
   * form that otherwise opens fully populated.
   */
  linksByMember?: Record<string, MemberLink[]>;
  /**
   * Opens the member's profile editor (CV lists, courses, projects) as a popup. Without it the
   * action links to the full page, /admin/team/[id].
   */
  onEditProfile?: (member: TeamMember) => void;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TeamMember | undefined>(undefined);

  const remove = useDeleteRecord<TeamMember>((id) => `/api/admin/team-members/${id}`);

  useEditFromQuery(items, (item) => {
    setEditing(item);
    setFormOpen(true);
  });

  function openCreate() {
    setEditing(undefined);
    setFormOpen(true);
  }

  return (
    <div id="members" className="scroll-mt-24">
      <FormSection
        title="Team members"
        description="Everyone on the public Team tab. Each member has a profile page with their CV and courses."
        badge={<FormSectionCount count={items.length} />}
        action={
          <Button aria-label="Add team member" onClick={openCreate}>
            <Plus className="size-4" aria-hidden="true" />
            Add
          </Button>
        }
      >
        <RecordTable
          items={items}
          noun="team members"
          searchText={(item) =>
            [item.name, item.citationName, item.role, item.team?.name].join(' ')
          }
          identityHeader="Member"
          identity={(item) => (
            <RecordIdentity
              leading={
                <Avatar
                  src={item.photoUrl}
                  alt=""
                  fallback={memberInitials(item.name)}
                  size="sm"
                  shape="circle"
                  className="size-8 ring-0"
                />
              }
              title={item.name}
              detail={item.role}
            />
          )}
          statusHeader="Profile"
          status={(item) =>
            item.photoUrl
              ? { tone: 'ok', label: 'Has photo' }
              : { tone: 'attention', label: 'No photo', icon: ImageOff }
          }
          groupHeader="Team"
          filter={{
            label: 'Filter by team',
            options: [
              { value: DIRECTOR, label: 'Director' },
              ...teams.map((team) => ({ value: team.id, label: team.name })),
              { value: NO_TEAM, label: 'No team' },
            ],
            valueOf: placeOf,
          }}
          group={(item) => (item.isDirector ? 'Director' : (item.team?.name ?? 'No team'))}
          rowLabel={(item) => `Actions: ${item.name}`}
          actions={(item) => [
            {
              label: 'Edit profile',
              ariaLabel: `Edit profile: ${item.name}`,
              icon: IdCard,
              ...(onEditProfile
                ? { onSelect: () => onEditProfile(item) }
                : { href: `/admin/team/${item.id}` }),
            },
            {
              label: 'Edit details',
              ariaLabel: `Edit: ${item.name}`,
              icon: Pencil,
              onSelect: () => {
                setEditing(item);
                setFormOpen(true);
              },
            },
            {
              label: 'Delete',
              ariaLabel: `Delete: ${item.name}`,
              icon: Trash2,
              destructive: true,
              onSelect: () => remove.request(item),
            },
          ]}
          empty={{
            icon: Users2,
            title: 'No team members yet.',
            description: 'Members appear on the public Team tab, each with their own profile page.',
            action: { label: 'Add your first team member', onClick: openCreate },
          }}
        />
      </FormSection>

      <TeamMemberFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        member={editing}
        links={editing ? (linksByMember[editing.id] ?? []) : []}
        teams={teams}
      />

      <ConfirmDialog
        {...remove.dialogProps}
        title="Delete this member?"
        confirmationText={remove.target?.name}
        description="Their profile, CV entries and courses are removed from the public site. This action cannot be undone."
      />
    </div>
  );
}
