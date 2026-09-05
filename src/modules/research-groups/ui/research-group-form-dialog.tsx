'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { UserMinus, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { apiSend } from '@/modules/shared/lib/api-client';
import { Dialog, DialogFooter } from '@/modules/shared/ui/dialog';
import { Avatar } from '@/modules/shared/ui/avatar';
import { Button } from '@/modules/shared/ui/button';
import { Input } from '@/modules/shared/ui/input';
import { Select } from '@/modules/shared/ui/select';
import { Textarea } from '@/modules/shared/ui/textarea';
import { FormField } from '@/modules/shared/ui/form-field';
// Deep, module-internal imports — see the equivalent comment in research-form-dialog.tsx (the
// barrel also re-exports Prisma-backed service getters; even a type-only barrel import drags
// Prisma/`pg` into the client bundle, confirmed empirically).
import type { ResearchGroup } from '../research-group.types';
import type { TeamMember } from '../team-member.types';
import { createResearchGroupSchema, type CreateResearchGroupInput } from '../research-group.schema';

function submitGroup(id: string | undefined, input: CreateResearchGroupInput) {
  return id
    ? apiSend<ResearchGroup>('PUT', `/api/admin/groups/${id}`, input)
    : apiSend<ResearchGroup>('POST', '/api/admin/groups', input);
}

/** Reassign one person to a group, or to no group at all. Membership lives on the member row. */
function setMemberGroup(memberId: string, researchGroupId: string | null) {
  return apiSend('PUT', `/api/admin/team-members/${memberId}`, { researchGroupId });
}

/**
 * The form edits three fields, so it asks for three fields. Narrower than `ResearchGroup` on
 * purpose: the admin table hands it a `ResearchGroupSummary` (no member rows), and the public
 * shape would not fit.
 */
type EditableGroup = Pick<ResearchGroup, 'id' | 'name' | 'description'>;

export function ResearchGroupFormDialog({
  open,
  onOpenChange,
  group,
  members = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group?: EditableGroup;
  /**
   * Every team member, not just this group's. The screen has already loaded them for the members
   * table below, so both the roster and the "add someone" picker are derived in memory — this
   * dialog issues no read of its own, and managing membership here costs no extra queries.
   */
  members?: TeamMember[];
}) {
  const router = useRouter();
  const isEdit = Boolean(group);
  const [pickedMemberId, setPickedMemberId] = useState('');

  const roster = group ? members.filter((m) => m.researchGroupId === group.id) : [];
  const selectable = group ? members.filter((m) => m.researchGroupId !== group.id) : [];

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

  const membership = useMutation({
    mutationFn: ({ memberId, groupId }: { memberId: string; groupId: string | null }) =>
      setMemberGroup(memberId, groupId),
    onSuccess: () => {
      setPickedMemberId('');
      // The dialog stays open: managing a roster is several actions in a row, and closing after
      // each one would make adding four people four trips back through the table.
      router.refresh();
    },
    onError: () => toast.error('Could not move that person. Please try again.'),
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

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            Save changes
          </Button>
        </DialogFooter>
      </form>

      {/* Members are managed only once the group exists — a membership edit is a PUT against a
          member row naming this group's id, and a group being created does not have one yet. */}
      {isEdit && group && (
        <section
          aria-labelledby="group-members-heading"
          className="mt-8 border-t border-border pt-6"
        >
          <h3 id="group-members-heading" className="text-sm font-semibold text-foreground">
            Members
            <span className="tabular ml-2 font-mono text-xs font-normal text-muted-foreground">
              {roster.length}
            </span>
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Moving someone here takes them out of whichever group they were in — a person belongs to
            one group at a time.
          </p>

          <div className="mt-4 flex gap-2">
            <Select
              aria-label="Add a member to this group"
              value={pickedMemberId}
              onChange={(event) => setPickedMemberId(event.target.value)}
              disabled={selectable.length === 0}
            >
              <option value="">
                {selectable.length === 0 ? 'Everyone is in this group' : 'Choose someone…'}
              </option>
              {selectable.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                  {member.researchGroupId ? ' — in another group' : ''}
                </option>
              ))}
            </Select>
            <Button
              type="button"
              variant="outline"
              disabled={!pickedMemberId || membership.isPending}
              loading={membership.isPending}
              onClick={() => membership.mutate({ memberId: pickedMemberId, groupId: group.id })}
            >
              <UserPlus className="size-4" aria-hidden="true" />
              Add
            </Button>
          </div>

          {roster.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Nobody in this group yet.</p>
          ) : (
            <ul className="mt-4 flex flex-col">
              {roster.map((member) => (
                <li
                  key={member.id}
                  className="flex items-center gap-3 border-t border-border py-2.5 first:border-t-0"
                >
                  <Avatar
                    src={member.photoUrl}
                    alt=""
                    fallback={member.name.slice(0, 1).toUpperCase()}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {member.name}
                      {member.nickname && (
                        <span className="ml-1.5 font-normal text-muted-foreground">
                          ({member.nickname})
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{member.role}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${member.name} from this group`}
                    disabled={membership.isPending}
                    onClick={() => membership.mutate({ memberId: member.id, groupId: null })}
                  >
                    <UserMinus className="size-4" aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </Dialog>
  );
}
