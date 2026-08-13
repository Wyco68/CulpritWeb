'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { Dialog } from '@/modules/shared/ui/dialog';
import { Button } from '@/modules/shared/ui/button';
import { Input } from '@/modules/shared/ui/input';
import { FormField } from '@/modules/shared/ui/form-field';
// Deep, module-internal import — see the equivalent comment in cancel-dialog.tsx.
import { rescheduleAppointmentSchema, type RescheduleAppointmentInput } from '../appointment.schema';

type RescheduleFormInput = z.input<typeof rescheduleAppointmentSchema>;

/** `<input type="datetime-local">` wants local wall-clock time with no offset/zone suffix. */
function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function RescheduleDialog({
  open,
  onOpenChange,
  scheduledAt,
  onConfirm,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Current `scheduledAt` to prefill; `undefined` while no row is selected. */
  scheduledAt: Date | undefined;
  onConfirm: (input: RescheduleAppointmentInput) => void;
  loading: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<RescheduleFormInput, unknown, RescheduleAppointmentInput>({
    resolver: zodResolver(rescheduleAppointmentSchema),
    values: { scheduledAt: scheduledAt ? toDatetimeLocalValue(scheduledAt) : '' },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
      title="Reschedule this appointment?"
      description="Only the date and time change — everything else stays the same. This does not move anything on Calendly."
      closeLabel="Close"
    >
      <form
        onSubmit={handleSubmit((values) => onConfirm(values))}
        noValidate
        className="flex flex-col gap-4"
      >
        <FormField
          label="Date & time"
          htmlFor="reschedule-scheduledAt"
          required
          error={errors.scheduledAt?.message}
        >
          {(fieldProps) => (
            <Input {...fieldProps} type="datetime-local" {...register('scheduledAt')} />
          )}
        </FormField>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Back
          </Button>
          <Button type="submit" loading={loading}>
            Reschedule
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
