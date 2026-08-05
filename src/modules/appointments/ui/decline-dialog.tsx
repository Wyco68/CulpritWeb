'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { Dialog } from '@/modules/shared/ui/dialog';
import { Button } from '@/modules/shared/ui/button';
import { Textarea } from '@/modules/shared/ui/textarea';
import { FormField } from '@/modules/shared/ui/form-field';
// Deep, module-internal import (not the barrel): `@/modules/appointments`'s index also re-exports
// `getAppointmentService`, whose composition root pulls in the Resend email client, which imports
// `env.server.ts` (guarded by the `server-only` package). Importing the barrel from a Client
// Component would drag that whole chain into the client bundle and throw at runtime. The pure,
// side-effect-free schema file is safe to import directly from a sibling `ui/` file.
import { adminDeclineSchema, type AdminDeclineInput } from '../appointment.schema';

export function DeclineDialog({
  open,
  onOpenChange,
  onConfirm,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (input: AdminDeclineInput) => void;
  loading: boolean;
}) {
  const t = useTranslations('admin.appointments');
  const tCommon = useTranslations('admin.common');

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<AdminDeclineInput>({ resolver: zodResolver(adminDeclineSchema), defaultValues: { reason: '' } });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
      title={t('declineDialogTitle')}
      description={t('declineDialogBody')}
      closeLabel={tCommon('close')}
    >
      <form
        onSubmit={handleSubmit((values) => onConfirm(values))}
        noValidate
        className="flex flex-col gap-4"
      >
        <FormField
          label={t('declineReasonLabel')}
          htmlFor="decline-reason"
          error={errors.reason?.message}
        >
          {(fieldProps) => <Textarea {...fieldProps} {...register('reason')} rows={3} />}
        </FormField>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {tCommon('cancel')}
          </Button>
          <Button type="submit" variant="destructive" loading={loading}>
            {t('decline')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
