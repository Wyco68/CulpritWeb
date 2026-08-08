'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Button } from '@/modules/shared/ui/button';
import { Switch } from '@/modules/shared/ui/switch';
import { Card, CardContent } from '@/modules/shared/ui/card';
// Deep, module-internal import: the barrel also re-exports service factories; kept off this
// client form for the same reason documented in the appointments module's dialogs.
import { updateSettingsSchema, type UpdateSettingsInput } from '../setting.schema';
import type { Settings } from '../setting.types';

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
  const router = useRouter();

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<UpdateSettingsInput>({
    resolver: zodResolver(updateSettingsSchema),
    defaultValues: {
      upcomingEventsVisible: settings.upcomingEventsVisible,
    },
  });

  const mutation = useMutation({
    mutationFn: saveSettings,
    onSuccess: () => {
      toast.success('Changes saved.');
      router.refresh();
    },
    onError: () => toast.error('Something went wrong. Please try again.'),
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
              Show Upcoming Events publicly
            </label>
            <p className="mt-1 text-sm text-muted-foreground">
              When off, visitors won&apos;t see the Upcoming Events tab.
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

      <div className="flex justify-end">
        <Button type="submit" size="lg" loading={isSubmitting || mutation.isPending}>
          Save changes
        </Button>
      </div>
    </form>
  );
}
