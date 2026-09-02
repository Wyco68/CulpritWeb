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
import { FormSection } from '@/modules/shared/ui/form-section';
// Deep, module-internal imports — see the equivalent comment in research-form-dialog.tsx. The
// barrel also re-exports the Prisma-backed `getProfileService`; even a type-only import of the
// barrel drags Prisma/`pg` into the client bundle (confirmed empirically — SWC didn't elide it),
// so both the schema AND the type import here go straight to their concrete files.
import type { Profile } from '../profile.types';
import { updateProfileSchema, type UpdateProfileInput } from '../profile.schema';
import { PhotoUploadField } from './photo-upload-field';

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
        className="flex flex-col gap-12 pb-24"
      >
        {/* Grouped into named sections rather than one flat column. */}
        <FormSection
          title="Identity"
          description="The name, role and portrait shown at the head of every page."
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              label="Full name"
              htmlFor="fullName"
              required
              error={errors.fullName?.message}
            >
              {(fieldProps) => <Input {...fieldProps} {...register('fullName')} />}
            </FormField>
            <FormField label="Title" htmlFor="title" required error={errors.title?.message}>
              {(fieldProps) => <Input {...fieldProps} {...register('title')} />}
            </FormField>
            <div className="sm:col-span-2">
              <PhotoUploadField />
              {errors.photoUrl && (
                <p role="alert" className="mt-2 text-xs font-medium text-destructive">
                  {errors.photoUrl.message}
                </p>
              )}
            </div>
          </div>
        </FormSection>

        <FormSection
          title="Written profile"
          description="The prose on the public About tab, in the order it appears there."
        >
          <div className="grid gap-5">
            <FormField
              label="Position & affiliation"
              htmlFor="positionAffiliation"
              description="One line, shown under the name in the site header."
              error={errors.positionAffiliation?.message}
            >
              {(fieldProps) => <Textarea {...fieldProps} {...register('positionAffiliation')} />}
            </FormField>
            <FormField
              label="Short bio"
              htmlFor="bio"
              description="The opening paragraph of the About tab."
              error={errors.bio?.message}
            >
              {(fieldProps) => <Textarea {...fieldProps} {...register('bio')} rows={4} />}
            </FormField>
            <FormField
              label="Research statement"
              htmlFor="researchStatement"
              description="A longer paragraph on research direction, shown below the bio."
              error={errors.researchStatement?.message}
            >
              {(fieldProps) => (
                <Textarea {...fieldProps} {...register('researchStatement')} rows={4} />
              )}
            </FormField>
          </div>
        </FormSection>

        <FormSection
          title="External profiles"
          description="Optional. Shown as links directly under the bio on the About tab."
        >
          <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            label="LinkedIn profile URL"
            htmlFor="linkedinUrl"
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
        </FormSection>

        {/* Education, fellowships, teaching roles and the rest are no longer edited here. They
            are `cv_entry` rows, managed one at a time on the Teaching screen — see ADR-012. This
            form is back to being what its name says: the singleton profile. */}
        {/* Pinned to the bottom of the viewport. This form is long enough that the submit button
            sat several screens below whatever you were editing, so saving meant scrolling to the
            end of a page you were in the middle of. */}
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 backdrop-blur-sm">
          <div className="mx-auto flex max-w-6xl items-center justify-end gap-4 px-6 py-3">
            <Button type="submit" size="lg" loading={isSubmitting || mutation.isPending}>
              Save changes
            </Button>
          </div>
        </div>
      </form>
    </FormProvider>
  );
}
