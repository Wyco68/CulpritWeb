'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { z } from 'zod';
import { useRouter } from '@/i18n/navigation';
import { Dialog } from '@/modules/shared/ui/dialog';
import { Button } from '@/modules/shared/ui/button';
import { Input } from '@/modules/shared/ui/input';
import { Textarea } from '@/modules/shared/ui/textarea';
import { Select } from '@/modules/shared/ui/select';
import { FormField } from '@/modules/shared/ui/form-field';
import type { ResearchGroup, TeamMember } from '@/modules/research-groups';
// Deep, module-internal import — see the equivalent comment in research-form-dialog.tsx (the
// barrel also re-exports Prisma-backed service getters, unsafe for a Client Component).
import { createTeamMemberSchema, type CreateTeamMemberInput } from '../team-member.schema';

type TeamMemberFormInput = z.input<typeof createTeamMemberSchema>;

async function submitTeamMember(id: string | undefined, input: CreateTeamMemberInput) {
  const response = await fetch(
    id ? `/api/admin/team-members/${id}` : '/api/admin/team-members',
    {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
  const body = await response.json();
  if (!body.ok) throw new Error(body.error?.message ?? 'Request failed');
  return body.data as TeamMember;
}

export function TeamMemberFormDialog({
  open,
  onOpenChange,
  member,
  groups,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member?: TeamMember;
  groups: ResearchGroup[];
}) {
  const t = useTranslations('admin.teamMembers');
  const tCommon = useTranslations('admin.common');
  const router = useRouter();
  const isEdit = Boolean(member);

  // `photoUrl`/`researchGroupId` normalize an empty select/input to `undefined`/`null` via
  // `setValueAs` at the field level — but that only runs on a field the user actually interacts
  // with; a field left at its untouched default never gets the chance, so `''` would otherwise
  // reach `.url()` and fail validation on an admin who simply leaves Photo URL blank. Normalizing
  // here, right before delegating to `zodResolver`, guarantees it regardless of touched state.
  const zodValidate = zodResolver(createTeamMemberSchema);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<TeamMemberFormInput, unknown, CreateTeamMemberInput>({
    resolver: (values, context, options) =>
      zodValidate(
        {
          ...values,
          photoUrl: values.photoUrl === '' ? undefined : values.photoUrl,
          researchGroupId: values.researchGroupId === '' ? null : values.researchGroupId,
        },
        context,
        options,
      ),
    values: {
      name: member?.name ?? '',
      role: member?.role ?? '',
      bio: member?.bio ?? '',
      photoUrl: member?.photoUrl ?? '',
      researchGroupId: member?.researchGroupId ?? '',
      sortOrder: member?.sortOrder ?? 0,
    },
  });

  const mutation = useMutation({
    mutationFn: (input: CreateTeamMemberInput) => submitTeamMember(member?.id, input),
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
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t('fields.name')} htmlFor="member-name" required error={errors.name?.message}>
            {(fieldProps) => <Input {...fieldProps} {...register('name')} />}
          </FormField>
          <FormField label={t('fields.role')} htmlFor="member-role" required error={errors.role?.message}>
            {(fieldProps) => <Input {...fieldProps} {...register('role')} />}
          </FormField>
        </div>
        <FormField
          label={t('fields.researchGroupId')}
          htmlFor="member-group"
          error={errors.researchGroupId?.message}
        >
          {(fieldProps) => (
            <Select
              {...fieldProps}
              {...register('researchGroupId', {
                setValueAs: (value: string) => (value === '' ? null : value),
              })}
            >
              <option value="">{t('fields.noGroup')}</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField label={t('fields.photoUrl')} htmlFor="member-photoUrl" error={errors.photoUrl?.message}>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              {...register('photoUrl', {
                setValueAs: (value: string) => (value === '' ? undefined : value),
              })}
              placeholder="https://…"
            />
          )}
        </FormField>
        <FormField label={t('fields.bio')} htmlFor="member-bio" error={errors.bio?.message}>
          {(fieldProps) => <Textarea {...fieldProps} {...register('bio')} rows={3} />}
        </FormField>
        <FormField
          label={t('fields.sortOrder')}
          htmlFor="member-sortOrder"
          error={errors.sortOrder?.message}
        >
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="number"
              min={0}
              {...register('sortOrder', { valueAsNumber: true })}
            />
          )}
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
