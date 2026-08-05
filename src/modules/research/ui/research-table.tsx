'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Pencil, Plus, Trash2, FlaskConical } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/modules/shared/ui/button';
import { EmptyState } from '@/modules/shared/ui/empty-state';
import { ConfirmDialog } from '@/modules/shared/ui/confirm-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/modules/shared/ui/table';
import type { Research } from '@/modules/research';
import { ResearchFormDialog } from './research-form-dialog';

async function deleteResearch(id: string) {
  const response = await fetch(`/api/admin/research/${id}`, { method: 'DELETE' });
  const body = await response.json();
  if (!body.ok) throw new Error(body.error?.message ?? 'Request failed');
}

export function ResearchTable({ items }: { items: Research[] }) {
  const t = useTranslations('admin.research');
  const tCommon = useTranslations('admin.common');
  const router = useRouter();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Research | undefined>(undefined);
  const [deleting, setDeleting] = useState<Research | undefined>(undefined);

  const deleteMutation = useMutation({
    mutationFn: deleteResearch,
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
        <EmptyState icon={FlaskConical} title={t('empty')} description={t('emptyBody')} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('columns.title')}</TableHead>
              <TableHead>{t('columns.area')}</TableHead>
              <TableHead>{t('columns.sortOrder')}</TableHead>
              <TableHead className="text-right">{tCommon('actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium text-foreground">{item.title}</TableCell>
                <TableCell className="text-muted-foreground">{item.area}</TableCell>
                <TableCell className="text-muted-foreground">{item.sortOrder}</TableCell>
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

      <ResearchFormDialog open={formOpen} onOpenChange={setFormOpen} research={editing} />

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
