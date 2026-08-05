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
  const t = useTranslations('admin.publications');
  const tCommon = useTranslations('admin.common');
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
        <FormField label={t('fields.title')} htmlFor="pub-title" required error={errors.title?.message}>
          {(fieldProps) => <Input {...fieldProps} {...register('title')} />}
        </FormField>
        <FormField
          label={t('fields.authors')}
          htmlFor="pub-authors"
          required
          error={errors.authors?.message}
        >
          {(fieldProps) => <Textarea {...fieldProps} {...register('authors')} rows={2} />}
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t('fields.venue')} htmlFor="pub-venue" required error={errors.venue?.message}>
            {(fieldProps) => <Input {...fieldProps} {...register('venue')} />}
          </FormField>
          <FormField label={t('fields.year')} htmlFor="pub-year" required error={errors.year?.message}>
            {(fieldProps) => (
              <Input {...fieldProps} type="number" {...register('year', { valueAsNumber: true })} />
            )}
          </FormField>
        </div>
        <FormField label={t('fields.link')} htmlFor="pub-link" required error={errors.link?.message}>
          {(fieldProps) => <Input {...fieldProps} type="url" {...register('link')} placeholder="https://…" />}
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
