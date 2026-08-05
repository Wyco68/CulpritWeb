'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ExternalLink, Pencil, Plus, Trash2, FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/modules/shared/ui/button';
import { EmptyState } from '@/modules/shared/ui/empty-state';
import { ConfirmDialog } from '@/modules/shared/ui/confirm-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/modules/shared/ui/table';
import type { Publication } from '@/modules/publications';
import { PublicationFormDialog } from './publication-form-dialog';

async function deletePublication(id: string) {
  const response = await fetch(`/api/admin/publications/${id}`, { method: 'DELETE' });
  const body = await response.json();
  if (!body.ok) throw new Error(body.error?.message ?? 'Request failed');
}

export function PublicationsTable({ items }: { items: Publication[] }) {
  const t = useTranslations('admin.publications');
  const tCommon = useTranslations('admin.common');
  const router = useRouter();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Publication | undefined>(undefined);
  const [deleting, setDeleting] = useState<Publication | undefined>(undefined);

  const deleteMutation = useMutation({
    mutationFn: deletePublication,
    onSuccess: () => {
      toast.success(tCommon('deleteSuccess'));
      setDeleting(undefined);
      router.refresh();
    },
    onError: () => toast.error(tCommon('deleteError')),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button
          onClick={() => {
            setEditing(undefined);
            setFormOpen(true);
          }}
        >
          <Plus className="size-4" aria-hidden="true" />
          {tCommon('add')}
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={FileText} title={t('empty')} description={t('emptyBody')} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('columns.title')}</TableHead>
              <TableHead>{t('columns.venue')}</TableHead>
              <TableHead>{t('columns.year')}</TableHead>
              <TableHead className="text-right">{tCommon('actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium text-foreground">
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 hover:text-accent hover:underline"
                  >
                    {item.title}
                    <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
                  </a>
                </TableCell>
                <TableCell className="text-muted-foreground">{item.venue}</TableCell>
                <TableCell className="text-muted-foreground">{item.year}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`${tCommon('edit')}: ${item.title}`}
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
                      aria-label={`${tCommon('delete')}: ${item.title}`}
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

      <PublicationFormDialog open={formOpen} onOpenChange={setFormOpen} publication={editing} />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(undefined)}
        title={tCommon('confirmDeleteTitle')}
        description={tCommon('confirmDeleteBody')}
        confirmLabel={tCommon('delete')}
        cancelLabel={tCommon('cancel')}
        loading={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />
    </div>
  );
}
