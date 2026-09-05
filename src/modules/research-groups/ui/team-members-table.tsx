'use client';

import { useState } from 'react';
import { Plus, Users2 } from 'lucide-react';
import { Avatar } from '@/modules/shared/ui/avatar';
import { useDeleteRecord } from '@/modules/shared/lib/use-delete-record';
import { Button } from '@/modules/shared/ui/button';
import { FormSection, FormSectionCount } from '@/modules/shared/ui/form-section';
import { EmptyState } from '@/modules/shared/ui/empty-state';
import { ConfirmDialog } from '@/modules/shared/ui/confirm-dialog';
import { RowActions } from '@/modules/shared/ui/row-actions';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/modules/shared/ui/table';
// Deep imports, not the barrel — see research-group-form-dialog.tsx's comment.
import type { ResearchGroupSummary } from '../research-group.types';
import type { TeamMember } from '../team-member.types';
import { TeamMemberFormDialog } from './team-member-form-dialog';

// `groups` is only ever read for an id-to-name map and the form's select options, so it takes
// summaries — the member rows nested inside a full `ResearchGroup` were never touched here.
export function TeamMembersTable({
  items,
  groups,
}: {
  items: TeamMember[];
  groups: ResearchGroupSummary[];
}) {
  const groupNameById = new Map(groups.map((group) => [group.id, group.name]));

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TeamMember | undefined>(undefined);

  const remove = useDeleteRecord<TeamMember>((id) => `/api/admin/team-members/${id}`);

  return (
    <div id="members" className="scroll-mt-24">
      <FormSection
        title="Team members"
        description="Researchers and visiting professors. A member with no group is listed on its own."
        badge={<FormSectionCount count={items.length} />}
        action={
          <Button
            aria-label="Add team member"
            onClick={() => {
              setEditing(undefined);
              setFormOpen(true);
            }}
          >
            <Plus className="size-4" aria-hidden="true" />
            Add
          </Button>
        }
      >
        {items.length === 0 ? (
          <EmptyState
            icon={Users2}
            title="No team members yet."
            description="Add the first team member."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Research group</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium text-foreground">
                    <div className="flex items-center gap-2.5">
                      <Avatar
                        src={item.photoUrl}
                        alt=""
                        fallback={item.name.slice(0, 1).toUpperCase()}
                        size="sm"
                        className="size-8 ring-0"
                      />
                      {item.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{item.role}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.researchGroupId
                      ? (groupNameById.get(item.researchGroupId) ?? 'None')
                      : 'None'}
                  </TableCell>
                  <TableCell className="text-right">
                    <RowActions
                      editLabel={`Edit: ${item.name}`}
                      deleteLabel={`Delete: ${item.name}`}
                      onEdit={() => {
                        setEditing(item);
                        setFormOpen(true);
                      }}
                      onDelete={() => remove.request(item)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </FormSection>

      <TeamMemberFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        member={editing}
        groups={groups}
      />

      <ConfirmDialog
        {...remove.dialogProps}
        title="Delete this item?"
        description="This action cannot be undone."
      />
    </div>
  );
}
