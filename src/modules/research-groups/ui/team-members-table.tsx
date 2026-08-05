'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Pencil, Plus, Trash2, Users2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useRouter } from '@/i18n/navigation';
import { Avatar } from '@/modules/shared/ui/avatar';
import { Button } from '@/modules/shared/ui/button';
import { EmptyState } from '@/modules/shared/ui/empty-state';
import { ConfirmDialog } from '@/modules/shared/ui/confirm-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/modules/shared/ui/table';
// Deep imports, not the barrel — see research-group-form-dialog.tsx's comment.
import type { ResearchGroup } from '../research-group.types';
import type { TeamMember } from '../team-member.types';
import { TeamMemberFormDialog } from './team-member-form-dialog';

async function deleteTeamMember(id: string) {
  const response = await fetch(`/api/admin/team-members/${id}`, { method: 'DELETE' });
  const body = await response.json();
  if (!body.ok) throw new Error(body.error?.message ?? 'Request failed');
}

export function TeamMembersTable({
  items,
  groups,
}: {
  items: TeamMember[];
  groups: ResearchGroup[];
}) {
  const t = useTranslations('admin.teamMembers');
  const tCommon = useTranslations('admin.common');
  const router = useRouter();
  const groupNameById = new Map(groups.map((group) => [group.id, group.name]));

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TeamMember | undefined>(undefined);
  const [deleting, setDeleting] = useState<TeamMember | undefined>(undefined);

  const deleteMutation = useMutation({
    mutationFn: deleteTeamMember,
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
        <EmptyState icon={Users2} title={t('empty')} description={t('emptyBody')} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('columns.name')}</TableHead>
              <TableHead>{t('columns.role')}</TableHead>
              <TableHead>{t('columns.group')}</TableHead>
              <TableHead className="text-right">{tCommon('actions')}</TableHead>
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
                    ? (groupNameById.get(item.researchGroupId) ?? tCommon('none'))
                    : tCommon('none')}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`${tCommon('edit')}: ${item.name}`}
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
                      aria-label={`${tCommon('delete')}: ${item.name}`}
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

      <TeamMemberFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        member={editing}
        groups={groups}
      />

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
