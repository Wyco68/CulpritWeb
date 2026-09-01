'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogFooter } from '@/modules/shared/ui/dialog';
import { Button } from '@/modules/shared/ui/button';
import { Textarea } from '@/modules/shared/ui/textarea';
import { FormField } from '@/modules/shared/ui/form-field';
// Deep, module-internal import — see the comment in `decline-dialog.tsx` for why this bypasses
// the barrel (which also re-exports the server-only-chained `getAppointmentService`).
import { cancelAppointmentSchema, type CancelAppointmentInput } from '../appointment.schema';

export function CancelDialog({
  open,
  onOpenChange,
  onConfirm,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (input: CancelAppointmentInput) => void;
  loading: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CancelAppointmentInput>({
    resolver: zodResolver(cancelAppointmentSchema),
    defaultValues: { reason: '' },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
      title="Cancel this appointment?"
      description="The record is kept for audit. This does not cancel anything on Calendly."
      closeLabel="Close"
    >
      <form
        onSubmit={handleSubmit((values) => onConfirm(values))}
        noValidate
        className="flex flex-col gap-4"
      >
        <FormField
          label="Reason"
          htmlFor="cancel-reason"
          required
          error={errors.reason?.message}
        >
          {(fieldProps) => <Textarea {...fieldProps} {...register('reason')} rows={3} />}
        </FormField>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Back
          </Button>
          <Button type="submit" variant="destructive" loading={loading}>
            Cancel
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
