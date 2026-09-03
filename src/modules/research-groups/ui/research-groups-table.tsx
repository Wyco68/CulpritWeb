'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Pencil, Plus, Trash2, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Button } from '@/modules/shared/ui/button';
import { FormSection, FormSectionCount } from '@/modules/shared/ui/form-section';
import { EmptyState } from '@/modules/shared/ui/empty-state';
import { ConfirmDialog } from '@/modules/shared/ui/confirm-dialog';
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
import { ResearchGroupFormDialog } from './research-group-form-dialog';

async function deleteGroup(id: string) {
  const response = await fetch(`/api/admin/groups/${id}`, { method: 'DELETE' });
  const body = await response.json();
  if (!body.ok) throw new Error(body.error?.message ?? 'Request failed');
}

// Takes summaries, not full groups: the only thing this table says about a group's people is how
// many there are, so it never needs the member rows.
export function ResearchGroupsTable({ items }: { items: ResearchGroupSummary[] }) {
  const router = useRouter();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ResearchGroupSummary | undefined>(undefined);
  const [deleting, setDeleting] = useState<ResearchGroupSummary | undefined>(undefined);

  const deleteMutation = useMutation({
    mutationFn: deleteGroup,
    onSuccess: () => {
      toast.success('Deleted.');
      setDeleting(undefined);
      router.refresh();
    },
    onError: () => toast.error('Could not delete. Please try again.'),
  });

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
                  <div className="flex justify-end gap-1.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit: ${item.name}`}
                      onClick={() => {
                        setEditing(item);
                        setFormOpen(true);
                      }}
                    >
                      <Pencil className="size-4" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete: ${item.name}`}
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => setDeleting(item)}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      </FormSection>

      <ResearchGroupFormDialog open={formOpen} onOpenChange={setFormOpen} group={editing} />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(undefined)}
        title="Delete this item?"
        description="This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        loading={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />
    </div>
  );
}
