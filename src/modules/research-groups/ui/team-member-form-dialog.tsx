'use client';

import { UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { z } from 'zod';
import { useRouter } from 'next/navigation';
import { apiSend } from '@/modules/shared/lib/api-client';
import { FormDialog, FormGroup } from '@/modules/shared/ui/form-dialog';
import { Select } from '@/modules/shared/ui/select';
import { Input } from '@/modules/shared/ui/input';
import { Textarea } from '@/modules/shared/ui/textarea';
import { FormField } from '@/modules/shared/ui/form-field';
import { PhotoUpload } from '@/modules/shared/ui/photo-upload';
// Deep, module-internal imports — see the equivalent comment in research-form-dialog.tsx (the
// barrel also re-exports Prisma-backed service getters; even a type-only barrel import drags
// Prisma/`pg` into the client bundle, confirmed empirically).
import type { MemberLink, TeamMember } from '../team-member.types';
import type { TeamRef } from '../team.types';
import {
  createTeamMemberSchema,
  type CreateTeamMemberInput,
  type MemberLinkInput,
} from '../team-member.schema';
import { MemberLinksField, type MemberLinkRow } from './member-links-field';

type TeamMemberFormInput = z.input<typeof createTeamMemberSchema>;

/**
 * What goes on the wire. `links` is optional here and NOT in `CreateTeamMemberInput`, because
 * omitting the key is the only way to say "leave the stored links alone" on an update — sending
 * `[]` replaces the list with nothing (see `updateTeamMemberSchema`). An untouched edit therefore
 * has to drop the key entirely, which `JSON.stringify` does for `undefined`.
 */
type TeamMemberPayload = Omit<CreateTeamMemberInput, 'links'> & { links?: MemberLinkInput[] };

function submitTeamMember(id: string | undefined, input: TeamMemberPayload) {
  return id
    ? apiSend<TeamMember>('PUT', `/api/admin/team-members/${id}`, input)
    : apiSend<TeamMember>('POST', '/api/admin/team-members', input);
}

export function TeamMemberFormDialog({
  open,
  onOpenChange,
  member,
  links = [],
  teams,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member?: TeamMember;
  /** The admin's teams, in display order, for the team picker. */
  teams: readonly TeamRef[];
  /** The member's stored links, in order. Empty for a new member. */
  links?: readonly MemberLink[];
}) {
  const router = useRouter();
  const isEdit = Boolean(member);
  // Whether the admin actually edited the link list this time round. Nothing else can tell the
  // difference between "left them alone" and "cleared them", and getting it wrong silently wipes
  // every link on a member the admin only meant to rename.
  const [linksTouched, setLinksTouched] = useState(false);
  useEffect(() => setLinksTouched(false), [member?.id, open]);

  // An untouched photo holds `''`, which would reach `httpUrl` and fail validation for an admin who
  // simply leaves it blank. Normalizing here, right before `zodResolver`, covers every case.
  const zodValidate = zodResolver(createTeamMemberSchema);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitted, isSubmitting, isDirty },
    reset,
  } = useForm<TeamMemberFormInput, unknown, CreateTeamMemberInput>({
    resolver: (values, context, options) =>
      zodValidate(
        {
          ...values,
          photoUrl: values.photoUrl === '' ? undefined : values.photoUrl,
          // The "No team" option's value is '' — on the wire that is an explicit null.
          teamId: values.teamId === '' ? null : values.teamId,
        },
        context,
        options,
      ),
    values: {
      name: member?.name ?? '',
      role: member?.role ?? '',
      citationName: member?.citationName ?? '',
      affiliation: member?.affiliation ?? '',
      bio: member?.bio ?? '',
      photoUrl: member?.photoUrl ?? '',
      teamId: member?.team?.id ?? '',
      // Only the editable halves: `id` and `sortOrder` are the server's, and the array order is
      // what becomes `sortOrder` on save.
      links: links.map(({ label, url }) => ({ label, url })),
      sortOrder: member?.sortOrder ?? 0,
    },
  });

  const linkRows: MemberLinkRow[] = watch('links') ?? [];
  // RHF mirrors the schema's shape, so an array field's errors are an array of per-field errors.
  const linkErrors = Array.isArray(errors.links) ? errors.links : [];

  const mutation = useMutation({
    mutationFn: (input: TeamMemberPayload) => submitTeamMember(member?.id, input),
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
    <FormDialog
      icon={UserRound}
      size="lg"
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? 'Edit team member' : 'Add team member'}
      onSubmit={handleSubmit(({ links: editedLinks, ...values }) =>
        // An edit that never went near the link editor sends no `links` key at all, which the
        // update route reads as "leave them alone". Creating always sends the list.
        mutation.mutate({
          ...values,
          links: isEdit && !linksTouched ? undefined : editedLinks,
        }),
      )}
      submitting={isSubmitting || mutation.isPending}
      dirty={isDirty}
      errorCount={Object.keys(errors).length}
    >
      <FormGroup title="Identity" columns={2}>
        <FormField label="Name" htmlFor="member-name" required error={errors.name?.message}>
          {(fieldProps) => <Input {...fieldProps} autoComplete="off" {...register('name')} />}
        </FormField>
        <FormField
          label="Name on papers"
          htmlFor="member-citationName"
          description="How they are credited on a byline, e.g. “J. Jaimunk”. Matching bylines link to their profile."
          error={errors.citationName?.message}
        >
          {(fieldProps) => (
            <Input {...fieldProps} autoComplete="off" {...register('citationName')} />
          )}
        </FormField>
        <FormField label="Role" htmlFor="member-role" required error={errors.role?.message}>
          {(fieldProps) => <Input {...fieldProps} autoComplete="off" {...register('role')} />}
        </FormField>
        <FormField
          label="Affiliation"
          htmlFor="member-affiliation"
          description="Optional. Institution or department."
          error={errors.affiliation?.message}
        >
          {(fieldProps) => (
            <Input {...fieldProps} autoComplete="off" {...register('affiliation')} />
          )}
        </FormField>
        {member?.isDirector ? (
          // The director heads the Team tab on their own and is never on a team; who holds the
          // title is fixed, not something this form can change (ADR-020).
          <p className="self-end text-sm text-muted-foreground sm:col-span-2">
            <span className="font-medium text-foreground">Lab director.</span> Featured on their own
            at the top of the Team tab, not under a team.
          </p>
        ) : (
          <FormField
            label="Team"
            htmlFor="member-teamId"
            description="Which heading they are listed under on the Team tab. Teams are added and renamed in the Teams section."
            error={errors.teamId?.message}
            className="sm:col-span-2"
          >
            {(fieldProps) => (
              <Select {...fieldProps} {...register('teamId')}>
                <option value="">No team</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
        )}
      </FormGroup>

      <FormGroup title="Photo and bio">
        {/* The admin picks a file; it uploads to object storage on selection and only the
            resulting URL is held in the form, so this dialog's own save stays a plain JSON PUT. */}
        <PhotoUpload
          value={watch('photoUrl')}
          onChange={(url) => setValue('photoUrl', url, { shouldDirty: true, shouldValidate: true })}
          endpoint="/api/admin/team-members/photo"
          personName={watch('name') || ''}
        />
        <FormField
          label="Bio"
          htmlFor="member-bio"
          description="Optional. Shown at the top of their profile page."
          error={errors.bio?.message}
        >
          {(fieldProps) => <Textarea {...fieldProps} {...register('bio')} rows={5} />}
        </FormField>
      </FormGroup>

      <FormGroup
        title="Profile links"
        description="Scholar, LinkedIn, GitHub, a personal site — whatever they have, in the order to show."
      >
        {/* Free-form `member_link` rows (ADR-017), edited as a repeatable list and saved with the
            rest of the member in one request. */}
        <MemberLinksField
          value={linkRows}
          errors={linkErrors.map((rowError) => ({
            label: rowError?.label?.message,
            url: rowError?.url?.message,
          }))}
          onChange={(next) => {
            setLinksTouched(true);
            // Quiet until the admin has tried to save once, then live: a row flagged "required"
            // the instant it is added is noise, but an error that survives the fix is a lie
            // (WCAG 3.3.1 wants the message to match the current value).
            setValue('links', next, { shouldDirty: true, shouldValidate: isSubmitted });
          }}
        />
      </FormGroup>

      <FormGroup title="Display">
        <FormField
          label="Sort order"
          htmlFor="member-sortOrder"
          description="Lower numbers appear first. The director is always listed first."
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
