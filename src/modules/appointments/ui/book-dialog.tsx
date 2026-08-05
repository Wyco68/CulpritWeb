'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { Dialog } from '@/modules/shared/ui/dialog';
import { Button } from '@/modules/shared/ui/button';
import { Input } from '@/modules/shared/ui/input';
import { FormField } from '@/modules/shared/ui/form-field';
// Deep, module-internal import — see the comment in `decline-dialog.tsx` for why this bypasses
// the barrel (which also re-exports the server-only-chained `getAppointmentService`).
import { adminBookSchema, type AdminBookInput } from '../appointment.schema';

export function BookDialog({
  open,
  onOpenChange,
  onConfirm,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (input: AdminBookInput) => void;
  loading: boolean;
}) {
  const t = useTranslations('admin.appointments');
  const tCommon = useTranslations('admin.common');

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<AdminBookInput>({
    resolver: zodResolver(adminBookSchema),
    defaultValues: { calendlyEventRef: '' },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
      title={t('bookDialogTitle')}
      description={t('bookDialogBody')}
      closeLabel={tCommon('close')}
    >
      <form
        onSubmit={handleSubmit((values) => onConfirm(values))}
        noValidate
        className="flex flex-col gap-4"
      >
        <FormField
          label={t('calendlyEventRefLabel')}
          htmlFor="book-calendly-ref"
          required
          error={errors.calendlyEventRef?.message}
        >
          {(fieldProps) => <Input {...fieldProps} {...register('calendlyEventRef')} />}
        </FormField>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {tCommon('cancel')}
          </Button>
          <Button type="submit" loading={loading}>
            {t('markBooked')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
