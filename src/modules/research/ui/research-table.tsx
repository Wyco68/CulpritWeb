'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Pencil, Plus, Trash2, FlaskConical } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Button } from '@/modules/shared/ui/button';
import { EmptyState } from '@/modules/shared/ui/empty-state';
import { ConfirmDialog } from '@/modules/shared/ui/confirm-dialog';
import { FormSection, FormSectionCount } from '@/modules/shared/ui/form-section';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/modules/shared/ui/table';
// Deep import, not the barrel — see research-form-dialog.tsx's comment.
import type { Research } from '../research.types';
import { ResearchFormDialog } from './research-form-dialog';

async function deleteResearch(id: string) {
  const response = await fetch(`/api/admin/research/${id}`, { method: 'DELETE' });
  const body = await response.json();
  if (!body.ok) throw new Error(body.error?.message ?? 'Request failed');
}

export function ResearchTable({ items }: { items: Research[] }) {
  const router = useRouter();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Research | undefined>(undefined);
  const [deleting, setDeleting] = useState<Research | undefined>(undefined);

  const deleteMutation = useMutation({
    mutationFn: deleteResearch,
    onSuccess: () => {
      toast.success('Deleted.');
      setDeleting(undefined);
      router.refresh();
    },
    onError: () => toast.error('Could not delete. Please try again.'),
  });

  return (
    <div id="works" className="scroll-mt-24">
      <FormSection
        title="Research works"
        description="The list on the public Research tab, ordered by the sort order below."
        badge={<FormSectionCount count={items.length} />}
        action={
          <Button
            aria-label="Add research work"
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
          icon={FlaskConical}
          title="No research works yet."
          description="Add the first research work to show it on the public site."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Area</TableHead>
              <TableHead>Order</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="min-w-0 font-medium text-foreground">
                  {/* User-entered text: bounded and wrapped, or one long unbroken title stretches
                      the table past its container. */}
                  <span className="line-clamp-2 block max-w-[46ch] break-words">{item.title}</span>
                </TableCell>
                <TableCell className="min-w-0 text-muted-foreground">
                  <span className="block max-w-[22ch] truncate" title={item.area}>
                    {item.area}
                  </span>
                </TableCell>
                <TableCell className="tabular text-muted-foreground">{item.sortOrder}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit: ${item.title}`}
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
                      aria-label={`Delete: ${item.title}`}
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


      <ResearchFormDialog open={formOpen} onOpenChange={setFormOpen} research={editing} />

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
