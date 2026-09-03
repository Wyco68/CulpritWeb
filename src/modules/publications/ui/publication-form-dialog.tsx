'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { z } from 'zod';
import { useRouter } from 'next/navigation';
import { Dialog, DialogFooter } from '@/modules/shared/ui/dialog';
import { Button } from '@/modules/shared/ui/button';
import { Input } from '@/modules/shared/ui/input';
import { Textarea } from '@/modules/shared/ui/textarea';
import { FormField } from '@/modules/shared/ui/form-field';
// Deep, module-internal imports — see the equivalent comment in research-form-dialog.tsx (the
// barrel also re-exports the Prisma-backed `getPublicationService`; even a type-only barrel
// import drags Prisma/`pg` into the client bundle, confirmed empirically).
import type { Publication } from '../publication.types';
import { createPublicationSchema, type CreatePublicationInput } from '../publication.schema';

type PublicationFormInput = z.input<typeof createPublicationSchema>;

async function submitPublication(id: string | undefined, input: CreatePublicationInput) {
  const response = await fetch(id ? `/api/admin/publications/${id}` : '/api/admin/publications', {
    method: id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await response.json();
  if (!body.ok) throw new Error(body.error?.message ?? 'Request failed');
  return body.data as Publication;
}

export function PublicationFormDialog({
  open,
  onOpenChange,
  publication,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  publication?: Publication;
}) {
  const router = useRouter();
  const isEdit = Boolean(publication);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<PublicationFormInput, unknown, CreatePublicationInput>({
    resolver: zodResolver(createPublicationSchema),
    values: {
      title: publication?.title ?? '',
      authors: publication?.authors ?? '',
      venue: publication?.venue ?? '',
      year: publication?.year ?? new Date().getFullYear(),
      link: publication?.link ?? '',
    },
  });

  const mutation = useMutation({
    mutationFn: (input: CreatePublicationInput) => submitPublication(publication?.id, input),
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
      title={isEdit ? 'Edit publication' : 'Add publication'}
      closeLabel="Close"
    >
      <form
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        noValidate
        className="flex flex-col gap-4"
      >
        <FormField label="Title" htmlFor="pub-title" required error={errors.title?.message}>
          {(fieldProps) => <Input {...fieldProps} {...register('title')} />}
        </FormField>
        <FormField label="Authors" htmlFor="pub-authors" required error={errors.authors?.message}>
          {(fieldProps) => <Textarea {...fieldProps} {...register('authors')} rows={2} />}
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Venue" htmlFor="pub-venue" required error={errors.venue?.message}>
            {(fieldProps) => <Input {...fieldProps} {...register('venue')} />}
          </FormField>
          <FormField label="Year" htmlFor="pub-year" required error={errors.year?.message}>
            {(fieldProps) => (
              <Input {...fieldProps} type="number" {...register('year', { valueAsNumber: true })} />
            )}
          </FormField>
        </div>
        <FormField
          label="Link"
          htmlFor="pub-link"
          description="Optional. Leave blank when the paper has no stable public URL."
          error={errors.link?.message}
        >
          {(fieldProps) => (
            <Input {...fieldProps} type="url" {...register('link')} placeholder="https://…" />
          )}
        </FormField>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            Save changes
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
