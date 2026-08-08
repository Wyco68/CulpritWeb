'use client';

import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
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
import { PhotoUploadField } from './photo-upload-field';

const LIST_FIELDS = [
  'education',
  'fellowshipsVisiting',
  'teachingRoles',
  'teachingAwards',
  'scholarshipsTravelAwards',
  'researchInterests',
  'invitedTalks',
] as const;

const LIST_FIELD_LABELS: Record<(typeof LIST_FIELDS)[number], string> = {
  education: 'Education',
  fellowshipsVisiting: 'Fellowships & visiting appointments',
  teachingRoles: 'Teaching roles',
  teachingAwards: 'Teaching awards',
  scholarshipsTravelAwards: 'Scholarships & travel awards',
  researchInterests: 'Research interests',
  invitedTalks: 'Invited talks',
};

function toFormDefaults(profile: Profile | null): UpdateProfileInput {
  return {
    fullName: profile?.fullName ?? '',
    title: profile?.title ?? '',
    photoUrl: profile?.photoUrl ?? undefined,
    bio: profile?.bio ?? undefined,
    positionAffiliation: profile?.positionAffiliation ?? undefined,
    researchStatement: profile?.researchStatement ?? undefined,
    linkedinUrl: profile?.linkedinUrl ?? undefined,
    googleScholarUrl: profile?.googleScholarUrl ?? undefined,
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
      toast.success('Changes saved.');
      router.refresh();
    },
    onError: () => {
      toast.error('Something went wrong. Please try again.');
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
          <FormField label="Full name" htmlFor="fullName" required error={errors.fullName?.message}>
            {(fieldProps) => <Input {...fieldProps} {...register('fullName')} />}
          </FormField>
          <FormField label="Title" htmlFor="title" required error={errors.title?.message}>
            {(fieldProps) => <Input {...fieldProps} {...register('title')} />}
          </FormField>
          <PhotoUploadField />
          {errors.photoUrl && (
            <p role="alert" className="-mt-2 text-xs font-medium text-destructive sm:col-span-2">
              {errors.photoUrl.message}
            </p>
          )}
          <FormField
            label="Position & affiliation"
            htmlFor="positionAffiliation"
            error={errors.positionAffiliation?.message}
            className="sm:col-span-2"
          >
            {(fieldProps) => <Textarea {...fieldProps} {...register('positionAffiliation')} />}
          </FormField>
          <FormField
            label="Short bio"
            htmlFor="bio"
            error={errors.bio?.message}
            className="sm:col-span-2"
          >
            {(fieldProps) => <Textarea {...fieldProps} {...register('bio')} rows={4} />}
          </FormField>
          <FormField
            label="Research statement"
            htmlFor="researchStatement"
            error={errors.researchStatement?.message}
            className="sm:col-span-2"
          >
            {(fieldProps) => (
              <Textarea {...fieldProps} {...register('researchStatement')} rows={4} />
            )}
          </FormField>
          <FormField
            label="LinkedIn profile URL"
            htmlFor="linkedinUrl"
            description="Optional. Shown as links on the public About tab."
            error={errors.linkedinUrl?.message}
          >
            {(fieldProps) => (
              <Input
                {...fieldProps}
                {...register('linkedinUrl', {
                  // Empty input clears the link rather than failing the server's `.url()` check.
                  setValueAs: (value: string) => (value === '' ? undefined : value),
                })}
                type="url"
                placeholder="https://www.linkedin.com/in/…"
              />
            )}
          </FormField>
          <FormField
            label="Google Scholar profile URL"
            htmlFor="googleScholarUrl"
            error={errors.googleScholarUrl?.message}
          >
            {(fieldProps) => (
              <Input
                {...fieldProps}
                {...register('googleScholarUrl', {
                  setValueAs: (value: string) => (value === '' ? undefined : value),
                })}
                type="url"
                placeholder="https://scholar.google.com/citations?user=…"
              />
            )}
          </FormField>
        </div>

        <div className="flex flex-col gap-5">
          {LIST_FIELDS.map((field) => (
            <ListFieldEditor key={field} name={field} heading={LIST_FIELD_LABELS[field]} />
          ))}
        </div>

        <div className="flex justify-end">
          <Button type="submit" size="lg" loading={isSubmitting || mutation.isPending}>
            Save changes
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
