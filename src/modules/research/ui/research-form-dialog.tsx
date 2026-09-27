'use client';

import { FlaskConical } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { z } from 'zod';
import { useRouter } from 'next/navigation';
import { apiSend } from '@/modules/shared/lib/api-client';
import { FormDialog, FormGroup } from '@/modules/shared/ui/form-dialog';
import { Input } from '@/modules/shared/ui/input';
import { Textarea } from '@/modules/shared/ui/textarea';
import { BylineField } from '@/modules/shared/ui/byline-field';
import { FormField } from '@/modules/shared/ui/form-field';
import { CoverField } from '@/modules/shared/ui/cover-field';
import { GalleryField } from '@/modules/shared/ui/gallery-field';
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

function submitResearch(id: string | undefined, input: CreateResearchInput) {
  return id
    ? apiSend<Research>('PUT', `/api/admin/research/${id}`, input)
    : apiSend<Research>('POST', '/api/admin/research', input);
}

export function ResearchFormDialog({
  open,
  onOpenChange,
  research,
  suggestions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present for edit; absent for create. */
  research?: Research;
  /** Lab member names offered while typing a byline. Passed down from the server page. */
  suggestions: readonly string[];
}) {
  const router = useRouter();
  const isEdit = Boolean(research);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting, isDirty },
    reset,
  } = useForm<ResearchFormInput, unknown, CreateResearchInput>({
    // The form always submits a fully-populated payload (controlled fields, not a partial patch),
    // so `createResearchSchema` (all fields required) validates both create and edit alike — it
    // matches what's actually sent even though the PUT route's own schema is `.partial()`.
    resolver: zodResolver(createResearchSchema),
    values: {
      title: research?.title ?? '',
      // Only the two fields that get sent back — sortOrder is re-derived from this array's order.
      contributors: research?.contributors.map(({ name }) => ({ name })) ?? [],
      summary: research?.summary ?? '',
      area: research?.area ?? '',
      link: research?.link ?? '',
      // `null` (not `''`) when there is none: an empty string would fail the URL check, and null
      // is also what a removal sends so the column is actually cleared.
      coverPhotoUrl: research?.coverPhotoUrl ?? null,
      coverCrop: research?.coverCrop ?? null,
      photoUrls: research?.photoUrls ?? [],
      sortOrder: research?.sortOrder ?? 0,
    },
  });

  // Photos are managed by their own widgets rather than `register`, so they are read and written
  // through watch/setValue. `?? []` guards the first render before `values` has been applied.
  const photoUrls = watch('photoUrls') ?? [];
  const coverPhotoUrl = watch('coverPhotoUrl') ?? null;
  const coverCrop = watch('coverCrop') ?? null;

  const mutation = useMutation({
    mutationFn: (input: CreateResearchInput) => submitResearch(research?.id, input),
    onSuccess: () => {
      toast.success(isEdit ? 'Changes saved.' : 'Created.');
      onOpenChange(false);
      reset();
      router.refresh();
    },
    onError: () => {
      toast.error(
        isEdit ? 'Something went wrong. Please try again.' : 'Could not create. Please try again.',
      );
    },
  });

  const busy = isSubmitting || mutation.isPending;

  return (
    <FormDialog
      icon={FlaskConical}
      size="lg"
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? 'Edit research work' : 'Add research work'}
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      submitting={busy}
      dirty={isDirty}
      errorCount={Object.keys(errors).length}
    >
      <FormGroup title="Basics" columns={2}>
        <FormField
          label="Title"
          htmlFor="research-title"
          required
          description="As it should appear on the public Research tab."
          error={errors.title?.message}
        >
          {(fieldProps) => <Input {...fieldProps} {...register('title')} />}
        </FormField>
        <FormField
          label="Area"
          htmlFor="research-area"
          required
          description="Works are grouped under their area, e.g. “Access Control”."
          error={errors.area?.message}
        >
          {(fieldProps) => <Input {...fieldProps} {...register('area')} />}
        </FormField>
      </FormGroup>

      <FormGroup title="Description">
        <FormField
          label="Summary"
          htmlFor="research-summary"
          required
          description="A short paragraph describing the work. Plain text, no formatting."
          error={errors.summary?.message}
        >
          {(fieldProps) => <Textarea {...fieldProps} {...register('summary')} rows={5} />}
        </FormField>
      </FormGroup>

      <FormGroup
        title="Card cover"
        description="The photo at the top of the work's card, cropped to fit it. Without a cover of its own, the card uses the first gallery photo."
      >
        <CoverField
          coverPhotoUrl={coverPhotoUrl}
          coverCrop={coverCrop}
          photoUrls={photoUrls}
          endpoint="/api/admin/research/photo"
          disabled={busy}
          onChange={(next) => {
            setValue('coverPhotoUrl', next.coverPhotoUrl, { shouldDirty: true });
            setValue('coverCrop', next.coverCrop, { shouldDirty: true });
          }}
        />
      </FormGroup>

      <FormGroup title="Gallery" description="Shown whole in the work's Show Details. Optional.">
        <GalleryField
          urls={photoUrls}
          endpoint="/api/admin/research/photo"
          firstIsCover={!coverPhotoUrl}
          disabled={busy}
          onChange={(next) =>
            setValue('photoUrls', next, { shouldDirty: true, shouldValidate: true })
          }
        />
        {errors.photoUrls && (
          <p role="alert" className="text-xs font-medium text-destructive">
            {errors.photoUrls.message}
          </p>
        )}
      </FormGroup>

      <FormGroup title="Credit and link">
        <Controller
          control={control}
          name="contributors"
          render={({ field }) => (
            <BylineField
              label="Contributors"
              description="Who worked on this. Leave empty for the lab's own work — no names are shown."
              error={errors.contributors?.message ?? errors.contributors?.root?.message}
              value={field.value ?? []}
              onChange={field.onChange}
              suggestions={suggestions}
              emptyHint="No contributors listed — this will show as the lab's own work."
            />
          )}
        />
        <FormField
          label="Project link"
          htmlFor="research-link"
          description="Optional. A tool listing, project page, or artefact repository."
          error={errors.link?.message}
        >
          {(fieldProps) => (
            <Input {...fieldProps} type="url" {...register('link')} placeholder="https://…" />
          )}
        </FormField>
      </FormGroup>

      <FormGroup title="Display">
        <FormField
          label="Sort order"
          htmlFor="research-sortOrder"
          description="Lower numbers appear first on the public tab."
          error={errors.sortOrder?.message}
        >
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="number"
              min={0}
              inputMode="numeric"
              className="w-28"
              {...register('sortOrder', { valueAsNumber: true })}
            />
          )}
        </FormField>
      </FormGroup>
    </FormDialog>
  );
}
