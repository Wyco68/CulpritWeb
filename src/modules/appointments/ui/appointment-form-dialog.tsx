'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { z } from 'zod';
import { useRouter } from 'next/navigation';
import { Dialog } from '@/modules/shared/ui/dialog';
import { Button } from '@/modules/shared/ui/button';
import { Input } from '@/modules/shared/ui/input';
import { Textarea } from '@/modules/shared/ui/textarea';
import { FormField } from '@/modules/shared/ui/form-field';
// Deep, module-internal imports — see the equivalent comment in research-form-dialog.tsx (the
// barrel also re-exports the Prisma-backed `getAppointmentService`; even a type-only barrel
// import drags Prisma/`pg` into the client bundle, confirmed empirically).
import type { Appointment } from '../appointment.types';
import { createAppointmentSchema, type CreateAppointmentInput } from '../appointment.schema';

type AppointmentFormInput = z.input<typeof createAppointmentSchema>;

/** `<input type="datetime-local">` wants local wall-clock time with no offset/zone suffix. */
function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

async function submitAppointment(id: string | undefined, input: CreateAppointmentInput) {
  const response = await fetch(id ? `/api/admin/appointments/${id}` : '/api/admin/appointments', {
    method: id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await response.json();
  if (!body.ok) throw new Error(body.error?.message ?? 'Request failed');
  return body.data as Appointment;
}

export function AppointmentFormDialog({
  open,
  onOpenChange,
  appointment,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment?: Appointment;
}) {
  const router = useRouter();
  const isEdit = Boolean(appointment);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<AppointmentFormInput, unknown, CreateAppointmentInput>({
    // The form always submits a fully-populated payload (controlled fields, not a partial patch),
    // so `createAppointmentSchema` validates both create and edit alike — matching the same
    // convention as research-form-dialog.tsx.
    resolver: zodResolver(createAppointmentSchema),
    values: {
      requesterName: appointment?.requesterName ?? '',
      requesterEmail: appointment?.requesterEmail ?? '',
      researchGroup: appointment?.researchGroup ?? '',
      scheduledAt: appointment ? toDatetimeLocalValue(appointment.scheduledAt) : '',
      topic: appointment?.topic ?? '',
    },
  });

  const mutation = useMutation({
    mutationFn: (input: CreateAppointmentInput) => submitAppointment(appointment?.id, input),
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
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
      title={isEdit ? 'Edit appointment' : 'Add appointment'}
      closeLabel="Close"
    >
      <form
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        noValidate
        className="flex flex-col gap-4"
      >
        <FormField
          label="Name"
          htmlFor="appointment-requesterName"
          required
          error={errors.requesterName?.message}
        >
          {(fieldProps) => <Input {...fieldProps} {...register('requesterName')} />}
        </FormField>
        <FormField
          label="Email"
          htmlFor="appointment-requesterEmail"
          description="Optional, for your own reference. No email is ever sent by this app."
          error={errors.requesterEmail?.message}
        >
          {(fieldProps) => <Input {...fieldProps} type="email" {...register('requesterEmail')} />}
        </FormField>
        <FormField
          label="Research group"
          htmlFor="appointment-researchGroup"
          error={errors.researchGroup?.message}
        >
          {(fieldProps) => <Input {...fieldProps} {...register('researchGroup')} />}
        </FormField>
        <FormField
          label="Date & time"
          htmlFor="appointment-scheduledAt"
          required
          error={errors.scheduledAt?.message}
        >
          {(fieldProps) => (
            <Input {...fieldProps} type="datetime-local" {...register('scheduledAt')} />
          )}
        </FormField>
        <FormField label="Topic" htmlFor="appointment-topic" error={errors.topic?.message}>
          {(fieldProps) => <Textarea {...fieldProps} {...register('topic')} rows={3} />}
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
