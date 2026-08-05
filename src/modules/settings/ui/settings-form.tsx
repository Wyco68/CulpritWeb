'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { z } from 'zod';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/modules/shared/ui/button';
import { Input } from '@/modules/shared/ui/input';
import { Switch } from '@/modules/shared/ui/switch';
import { FormField } from '@/modules/shared/ui/form-field';
import { Card, CardContent } from '@/modules/shared/ui/card';
// Deep, module-internal import: the barrel also re-exports service factories; kept off this
// client form for the same reason documented in the appointments module's dialogs.
import { updateSettingsSchema, type UpdateSettingsInput } from '../setting.schema';
import type { Settings } from '../setting.types';

// `appointmentDurationMinutes` uses `z.coerce.number()` (raw input type `unknown`) — see the same
// pattern/comment in research-form-dialog.tsx.
type SettingsFormInput = z.input<typeof updateSettingsSchema>;

async function saveSettings(input: UpdateSettingsInput) {
  const response = await fetch('/api/admin/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await response.json();
  if (!body.ok) throw new Error(body.error?.message ?? 'Request failed');
  return body.data as Settings;
}

export function SettingsForm({ settings }: { settings: Settings }) {
  const t = useTranslations('admin.settings');
  const tCommon = useTranslations('admin.common');
  const router = useRouter();

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SettingsFormInput, unknown, UpdateSettingsInput>({
    resolver: zodResolver(updateSettingsSchema),
    defaultValues: {
      upcomingEventsVisible: settings.upcomingEventsVisible,
      appointmentDurationMinutes: settings.appointmentDurationMinutes,
    },
  });

  const mutation = useMutation({
    mutationFn: saveSettings,
    onSuccess: () => {
      toast.success(tCommon('saveSuccess'));
      router.refresh();
    },
    onError: () => toast.error(tCommon('saveError')),
  });

  return (
    <form
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      noValidate
      className="flex flex-col gap-4"
    >
      <Card>
        <CardContent className="flex items-start justify-between gap-6 p-5">
          <div>
            <label htmlFor="upcomingEventsVisible" className="text-sm font-medium text-foreground">
              {t('upcomingEventsVisibleLabel')}
            </label>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('upcomingEventsVisibleDescription')}
            </p>
          </div>
          <Controller
            control={control}
            name="upcomingEventsVisible"
            render={({ field }) => (
              <Switch
                id="upcomingEventsVisible"
                checked={field.value ?? false}
                onCheckedChange={field.onChange}
              />
            )}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <FormField
            label={t('appointmentDurationLabel')}
            htmlFor="appointmentDurationMinutes"
            description={t('appointmentDurationDescription')}
            error={errors.appointmentDurationMinutes?.message}
          >
            {(fieldProps) => (
              <Input
                {...fieldProps}
                type="number"
                min={5}
                max={480}
                className="max-w-40"
                {...register('appointmentDurationMinutes', { valueAsNumber: true })}
              />
            )}
          </FormField>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" size="lg" loading={isSubmitting || mutation.isPending}>
          {tCommon('save')}
        </Button>
      </div>
    </form>
  );
}
