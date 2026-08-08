'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Dialog } from '@/modules/shared/ui/dialog';
import { Button } from '@/modules/shared/ui/button';
import { Input } from '@/modules/shared/ui/input';
import { Textarea } from '@/modules/shared/ui/textarea';
import { FormField } from '@/modules/shared/ui/form-field';
// Deep, module-internal imports — see the equivalent comment in research-form-dialog.tsx (the
// barrel also re-exports Prisma-backed service getters; even a type-only barrel import drags
// Prisma/`pg` into the client bundle, confirmed empirically).
import type { ResearchGroup } from '../research-group.types';
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
      toast.success(isEdit ? 'Changes saved.' : 'Created.');
      onOpenChange(false);
      reset();
      router.refresh();
    },
    onError: () =>
      toast.error(
        isEdit ? 'Something went wrong. Please try again.' : 'Could not create. Please try again.',
      ),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? 'Edit research group' : 'Add research group'}
      closeLabel="Close"
    >
      <form
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        noValidate
        className="flex flex-col gap-4"
      >
        <FormField label="Name" htmlFor="group-name" required error={errors.name?.message}>
          {(fieldProps) => <Input {...fieldProps} {...register('name')} />}
        </FormField>
        <FormField
          label="Description"
          htmlFor="group-description"
          required
          error={errors.description?.message}
        >
          {(fieldProps) => <Textarea {...fieldProps} {...register('description')} rows={4} />}
        </FormField>

        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            Save changes
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
