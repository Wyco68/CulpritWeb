'use client';

import { useState } from 'react';
import { Plus, Building2 } from 'lucide-react';
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
// Deep import, not the barrel — see research-group-form-dialog.tsx's comment.
import type { ResearchGroupSummary } from '../research-group.types';
import type { TeamMember } from '../team-member.types';
import { ResearchGroupFormDialog } from './research-group-form-dialog';

// Takes summaries, not full groups: the only thing this table says about a group's people is how
// many there are, so it never needs the member rows.
export function ResearchGroupsTable({
  items,
  members = [],
}: {
  items: ResearchGroupSummary[];
  /** Passed straight through to the dialog so it can manage this group's roster in memory. */
  members?: TeamMember[];
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ResearchGroupSummary | undefined>(undefined);

  const remove = useDeleteRecord<ResearchGroupSummary>((id) => `/api/admin/groups/${id}`);

  return (
    <div id="groups" className="scroll-mt-24">
      <FormSection
        title="Research groups"
        description="Each group and its description, as shown on the public Team Members tab."
        badge={<FormSectionCount count={items.length} />}
        action={
          <Button
            aria-label="Add research group"
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
            icon={Building2}
            title="No research groups yet."
            description="Add the first research group to organize team members under it."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Members</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium text-foreground">{item.name}</TableCell>
                  <TableCell className="text-muted-foreground">{item.memberCount}</TableCell>
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

      <ResearchGroupFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        group={editing}
        members={members}
      />

      <ConfirmDialog
        {...remove.dialogProps}
        title="Delete this item?"
        description="This action cannot be undone."
      />
    </div>
  );
}
