'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useRouter } from '@/i18n/navigation';
import { Dialog } from '@/modules/shared/ui/dialog';
import { Button } from '@/modules/shared/ui/button';
import { Input } from '@/modules/shared/ui/input';
import { Textarea } from '@/modules/shared/ui/textarea';
import { FormField } from '@/modules/shared/ui/form-field';
import type { ResearchGroup } from '@/modules/research-groups';
// Deep, module-internal import — see the equivalent comment in research-form-dialog.tsx (the
// barrel also re-exports Prisma-backed service getters, unsafe for a Client Component).
import { createResearchGroupSchema, type CreateResearchGroupInput } from '../research-group.schema';

async function submitGroup(id: string | undefined, input: CreateResearchGroupInput) {
  const response = await fetch(id ? `/api/admin/groups/${id}` : '/api/admin/groups', {
    method: id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await response.json();
  if (!body.ok) throw new Error(body.error?.message ?? 'Request failed');
  return body.data as ResearchGroup;
}

export function ResearchGroupFormDialog({
  open,
  onOpenChange,
  group,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group?: ResearchGroup;
}) {
  const t = useTranslations('admin.groups');
  const tCommon = useTranslations('admin.common');
  const router = useRouter();
  const isEdit = Boolean(group);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<CreateResearchGroupInput>({
    resolver: zodResolver(createResearchGroupSchema),
    values: {
      name: group?.name ?? '',
      description: group?.description ?? '',
    },
  });

  const mutation = useMutation({
    mutationFn: (input: CreateResearchGroupInput) => submitGroup(group?.id, input),
    onSuccess: () => {
      toast.success(isEdit ? tCommon('saveSuccess') : tCommon('createSuccess'));
      onOpenChange(false);
      reset();
      router.refresh();
    },
    onError: () => toast.error(isEdit ? tCommon('saveError') : tCommon('createError')),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? t('editTitle') : t('addTitle')}
      closeLabel={tCommon('close')}
    >
      <form
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        noValidate
        className="flex flex-col gap-4"
      >
        <FormField label={t('fields.name')} htmlFor="group-name" required error={errors.name?.message}>
          {(fieldProps) => <Input {...fieldProps} {...register('name')} />}
        </FormField>
        <FormField
          label={t('fields.description')}
          htmlFor="group-description"
          required
          error={errors.description?.message}
        >
          {(fieldProps) => <Textarea {...fieldProps} {...register('description')} rows={4} />}
        </FormField>

        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {tCommon('cancel')}
          </Button>
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            {tCommon('save')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
