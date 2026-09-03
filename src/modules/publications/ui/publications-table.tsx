'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ExternalLink, Pencil, Plus, Trash2, FileText } from 'lucide-react';
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
// Deep import, not the barrel — see publication-form-dialog.tsx's comment.
import type { Publication } from '../publication.types';
import { PublicationFormDialog } from './publication-form-dialog';

async function deletePublication(id: string) {
  const response = await fetch(`/api/admin/publications/${id}`, { method: 'DELETE' });
  const body = await response.json();
  if (!body.ok) throw new Error(body.error?.message ?? 'Request failed');
}

export function PublicationsTable({ items }: { items: Publication[] }) {
  const router = useRouter();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Publication | undefined>(undefined);
  const [deleting, setDeleting] = useState<Publication | undefined>(undefined);

  const deleteMutation = useMutation({
    mutationFn: deletePublication,
    onSuccess: () => {
      toast.success('Deleted.');
      setDeleting(undefined);
      router.refresh();
    },
    onError: () => toast.error('Could not delete. Please try again.'),
  });

  return (
    <div id="publications" className="scroll-mt-24">
      <FormSection
        title="Publications"
        description="Every peer-reviewed entry on the public Publications tab, newest year first."
        badge={<FormSectionCount count={items.length} />}
        action={
          <Button
            aria-label="Add publication"
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
          icon={FileText}
          title="No publications yet."
          description="Add the first publication to show it on the public site."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Venue</TableHead>
              <TableHead>Year</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium text-foreground">
                  {item.link ? (
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 hover:text-accent hover:underline"
                    >
                      {item.title}
                      <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
                    </a>
                  ) : (
                    item.title
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{item.venue}</TableCell>
                <TableCell className="text-muted-foreground">{item.year}</TableCell>
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

      <PublicationFormDialog open={formOpen} onOpenChange={setFormOpen} publication={editing} />

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
