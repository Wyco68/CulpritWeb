'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { Dialog } from '@/modules/shared/ui/dialog';
import { Button } from '@/modules/shared/ui/button';
import { Textarea } from '@/modules/shared/ui/textarea';
import { FormField } from '@/modules/shared/ui/form-field';
// Deep, module-internal import — see the comment in `decline-dialog.tsx` for why this bypasses
// the barrel (which also re-exports the server-only-chained `getAppointmentService`).
import { adminCancelSchema, type AdminCancelInput } from '../appointment.schema';

export function CancelDialog({
  open,
  onOpenChange,
  onConfirm,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (input: AdminCancelInput) => void;
  loading: boolean;
}) {
  const t = useTranslations('admin.appointments');
  const tCommon = useTranslations('admin.common');

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<AdminCancelInput>({ resolver: zodResolver(adminCancelSchema), defaultValues: { reason: '' } });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
      title={t('cancelDialogTitle')}
      description={t('cancelDialogBody')}
      closeLabel={tCommon('close')}
    >
      <form
        onSubmit={handleSubmit((values) => onConfirm(values))}
        noValidate
        className="flex flex-col gap-4"
      >
        <FormField
          label={t('cancelReasonLabel')}
          htmlFor="cancel-reason"
          required
          error={errors.reason?.message}
        >
          {(fieldProps) => <Textarea {...fieldProps} {...register('reason')} rows={3} />}
        </FormField>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {tCommon('cancel')}
          </Button>
          <Button type="submit" variant="destructive" loading={loading}>
            {t('cancel')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
