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
// Deep, module-internal imports (not the barrel): `@/modules/research`'s index also re-exports
// `getResearchService`, whose composition root imports the Prisma repository (`pg`/`fs`, Node-only).
// A Client Component importing that barrel — even a type-only import, confirmed empirically —
// would drag Prisma into the browser bundle and fail to resolve `fs` at build time. The pure,
// side-effect-free `.types`/`.schema` files are safe to import directly.
import type { Research } from '../research.types';
import { createResearchSchema, type CreateResearchInput } from '../research.schema';

// `sortOrder` uses `z.coerce.number()`, whose *input* type (raw, pre-coercion) is `unknown` —
// wider than its *output* type (`number`). RHF's 3-generic `useForm<Input, Context, Output>`
// keeps the form's raw field values loosely typed for that field while `handleSubmit`'s callback
// still receives the fully-validated, correctly-typed `CreateResearchInput`.
type ResearchFormInput = z.input<typeof createResearchSchema>;

async function submitResearch(id: string | undefined, input: CreateResearchInput) {
  const response = await fetch(id ? `/api/admin/research/${id}` : '/api/admin/research', {
    method: id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await response.json();
  if (!body.ok) throw new Error(body.error?.message ?? 'Request failed');
  return body.data as Research;
}

export function ResearchFormDialog({
  open,
  onOpenChange,
  research,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present for edit; absent for create. */
  research?: Research;
}) {
  const t = useTranslations('admin.research');
  const tCommon = useTranslations('admin.common');
  const router = useRouter();
  const isEdit = Boolean(research);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ResearchFormInput, unknown, CreateResearchInput>({
    // The form always submits a fully-populated payload (controlled fields, not a partial patch),
    // so `createResearchSchema` (all fields required) validates both create and edit alike — it
    // matches what's actually sent even though the PUT route's own schema is `.partial()`.
    resolver: zodResolver(createResearchSchema),
    values: {
      title: research?.title ?? '',
      summary: research?.summary ?? '',
      area: research?.area ?? '',
      sortOrder: research?.sortOrder ?? 0,
    },
  });

  const mutation = useMutation({
    mutationFn: (input: CreateResearchInput) => submitResearch(research?.id, input),
    onSuccess: () => {
      toast.success(isEdit ? tCommon('saveSuccess') : tCommon('createSuccess'));
      onOpenChange(false);
      reset();
      router.refresh();
    },
    onError: () => {
      toast.error(isEdit ? tCommon('saveError') : tCommon('createError'));
    },
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
        <FormField label={t('fields.title')} htmlFor="research-title" required error={errors.title?.message}>
          {(fieldProps) => <Input {...fieldProps} {...register('title')} />}
        </FormField>
        <FormField
          label={t('fields.area')}
          htmlFor="research-area"
          required
          error={errors.area?.message}
        >
          {(fieldProps) => <Input {...fieldProps} {...register('area')} />}
        </FormField>
        <FormField
          label={t('fields.summary')}
          htmlFor="research-summary"
          required
          error={errors.summary?.message}
        >
          {(fieldProps) => <Textarea {...fieldProps} {...register('summary')} rows={4} />}
        </FormField>
        <FormField
          label={t('fields.sortOrder')}
          htmlFor="research-sortOrder"
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
