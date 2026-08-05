'use client';

import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/modules/shared/ui/button';
import { Input } from '@/modules/shared/ui/input';
import { Textarea } from '@/modules/shared/ui/textarea';
import { FormField } from '@/modules/shared/ui/form-field';
// Deep, module-internal imports — see the equivalent comment in research-form-dialog.tsx. The
// barrel also re-exports the Prisma-backed `getProfileService`; even a type-only import of the
// barrel drags Prisma/`pg` into the client bundle (confirmed empirically — SWC didn't elide it),
// so both the schema AND the type import here go straight to their concrete files.
import type { Profile } from '../profile.types';
import { updateProfileSchema, type UpdateProfileInput } from '../profile.schema';
import { ListFieldEditor } from './list-field-editor';

const LIST_FIELDS = [
  'education',
  'fellowshipsVisiting',
  'teachingRoles',
  'teachingAwards',
  'scholarshipsTravelAwards',
  'researchInterests',
  'invitedTalks',
] as const;

function toFormDefaults(profile: Profile | null): UpdateProfileInput {
  return {
    fullName: profile?.fullName ?? '',
    title: profile?.title ?? '',
    photoUrl: profile?.photoUrl ?? undefined,
    bio: profile?.bio ?? undefined,
    positionAffiliation: profile?.positionAffiliation ?? undefined,
    researchStatement: profile?.researchStatement ?? undefined,
    education: profile?.education ?? [],
    fellowshipsVisiting: profile?.fellowshipsVisiting ?? [],
    teachingRoles: profile?.teachingRoles ?? [],
    teachingAwards: profile?.teachingAwards ?? [],
    scholarshipsTravelAwards: profile?.scholarshipsTravelAwards ?? [],
    researchInterests: profile?.researchInterests ?? [],
    invitedTalks: profile?.invitedTalks ?? [],
  };
}

async function saveProfile(input: UpdateProfileInput) {
  const response = await fetch('/api/admin/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await response.json();
  if (!body.ok) throw new Error(body.error?.message ?? 'Request failed');
  return body.data as Profile;
}

export function ProfileForm({ profile }: { profile: Profile | null }) {
  const t = useTranslations('admin.profile');
  const tCommon = useTranslations('admin.common');
  const router = useRouter();

  const form = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: toFormDefaults(profile),
  });
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = form;

  const mutation = useMutation({
    mutationFn: saveProfile,
    onSuccess: () => {
      toast.success(tCommon('saveSuccess'));
      router.refresh();
    },
    onError: () => {
      toast.error(tCommon('saveError'));
    },
  });

  return (
    <FormProvider {...form}>
      <form
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        noValidate
        className="flex flex-col gap-8"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t('fullName')} htmlFor="fullName" required error={errors.fullName?.message}>
            {(fieldProps) => <Input {...fieldProps} {...register('fullName')} />}
          </FormField>
          <FormField label={t('titleField')} htmlFor="title" required error={errors.title?.message}>
            {(fieldProps) => <Input {...fieldProps} {...register('title')} />}
          </FormField>
          <FormField
            label={t('photoUrl')}
            htmlFor="photoUrl"
            error={errors.photoUrl?.message}
            className="sm:col-span-2"
          >
            {(fieldProps) => (
              <Input
                {...fieldProps}
                {...register('photoUrl', {
                  // An empty input clears the photo (`undefined`), rather than failing the
                  // server schema's `.url()` check on `''`. Normalized before validation runs.
                  setValueAs: (value: string) => (value === '' ? undefined : value),
                })}
                placeholder="https://…"
              />
            )}
          </FormField>
          <FormField
            label={t('positionAffiliation')}
            htmlFor="positionAffiliation"
            error={errors.positionAffiliation?.message}
            className="sm:col-span-2"
          >
            {(fieldProps) => <Textarea {...fieldProps} {...register('positionAffiliation')} />}
          </FormField>
          <FormField
            label={t('bio')}
            htmlFor="bio"
            error={errors.bio?.message}
            className="sm:col-span-2"
          >
            {(fieldProps) => <Textarea {...fieldProps} {...register('bio')} rows={4} />}
          </FormField>
          <FormField
            label={t('researchStatement')}
            htmlFor="researchStatement"
            error={errors.researchStatement?.message}
            className="sm:col-span-2"
          >
            {(fieldProps) => (
              <Textarea {...fieldProps} {...register('researchStatement')} rows={4} />
            )}
          </FormField>
        </div>

        <div className="flex flex-col gap-5">
          {LIST_FIELDS.map((field) => (
            <ListFieldEditor key={field} name={field} heading={t(`sections.${field}`)} />
          ))}
        </div>

        <div className="flex justify-end">
          <Button type="submit" size="lg" loading={isSubmitting || mutation.isPending}>
            {tCommon('save')}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
