'use client';

import { CalendarDays } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { z } from 'zod';
import { useRouter } from 'next/navigation';
import { apiSend } from '@/modules/shared/lib/api-client';
import { FormDialog, FormGroup } from '@/modules/shared/ui/form-dialog';
import { Input } from '@/modules/shared/ui/input';
import { Switch } from '@/modules/shared/ui/switch';
import { Textarea } from '@/modules/shared/ui/textarea';
import { FormField } from '@/modules/shared/ui/form-field';
import { CoverField } from '@/modules/shared/ui/cover-field';
import { GalleryField } from '@/modules/shared/ui/gallery-field';
import { toInstitutionLocalDatetimeValue } from '@/modules/shared/lib/timezone';
// Deep, module-internal imports (not the barrel): `@/modules/events`'s index also re-exports
// `getEventService`, whose composition root imports the Prisma repository (`pg`/`fs`, Node-only).
// A Client Component importing that barrel — even a type-only import — drags Prisma into the
// browser bundle and fails to resolve `fs` at build time. The pure, side-effect-free
// `.types`/`.schema` files are safe to import directly.
import type { Event } from '../event.types';
import { createEventSchema, type CreateEventInput } from '../event.schema';
import { VideoLinkList } from './event-media-fields';

// `eventDate` goes through `z.preprocess`, whose *input* type is `unknown` — wider than its
// *output* type (`Date`). RHF's 3-generic `useForm<Input, Context, Output>` keeps the form's raw
// field values loosely typed for that field while `handleSubmit`'s callback still receives the
// fully-validated, correctly-typed `CreateEventInput`.
type EventFormInput = z.input<typeof createEventSchema>;

/** Prefill for the date input: "YYYY-MM-DDTHH:mm" with a time, "YYYY-MM-DD" without. */
function toDateInputValue(date: Date, showTime: boolean): string {
  const value = toInstitutionLocalDatetimeValue(date);
  return showTime ? value : value.slice(0, 10);
}

function submitEvent(id: string | undefined, input: CreateEventInput) {
  return id
    ? apiSend<Event>('PUT', `/api/admin/events/${id}`, input)
    : apiSend<Event>('POST', '/api/admin/events', input);
}

export function EventFormDialog({
  open,
  onOpenChange,
  event,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present for edit; absent for create. */
  event?: Event;
}) {
  const router = useRouter();
  const isEdit = Boolean(event);

  const {
    register,
    handleSubmit,
    watch,
    getValues,
    setValue,
    formState: { errors, isSubmitting, isDirty },
    reset,
  } = useForm<EventFormInput, unknown, CreateEventInput>({
    // The form always submits a fully-populated payload (controlled fields, not a partial patch),
    // so `createEventSchema` validates both create and edit alike — it matches what is actually
    // sent even though the PUT route's own schema is `.partial()`.
    resolver: zodResolver(createEventSchema),
    values: {
      title: event?.title ?? '',
      description: event?.description ?? '',
      content: event?.content ?? '',
      // The input is a bare `datetime-local` (or `date`), so it must be prefilled in the
      // INSTITUTION's wall-clock time, not the admin's browser zone — otherwise editing an event
      // from a different timezone would silently shift it on save.
      eventDate: event ? toDateInputValue(event.eventDate, event.showTime) : '',
      showTime: event?.showTime ?? false,
      photoUrls: event?.photoUrls ?? [],
      videoUrls: event?.videoUrls ?? [],
      coverPhotoUrl: event?.coverPhotoUrl ?? null,
      coverCrop: event?.coverCrop ?? null,
    },
  });

  // Media are managed by their own widgets rather than `register`, so they are read and written
  // through watch/setValue. `?? []` guards the first render before `values` has been applied.
  const photoUrls = watch('photoUrls') ?? [];
  const videoUrls = watch('videoUrls') ?? [];
  const coverPhotoUrl = watch('coverPhotoUrl') ?? null;
  const coverCrop = watch('coverCrop') ?? null;
  const showTime = watch('showTime') ?? false;

  // The date input changes type with the switch, so its value is carried across in the new
  // format. Turning the time back on starts from midnight — a time that was hidden isn't kept.
  function toggleTime(next: boolean) {
    const current = String(getValues('eventDate') ?? '');
    setValue('showTime', next, { shouldDirty: true });
    if (!current) return;
    const day = current.slice(0, 10);
    setValue('eventDate', next ? `${day}T${current.slice(11, 16) || '00:00'}` : day, {
      shouldDirty: true,
    });
  }

  const mutation = useMutation({
    mutationFn: (input: CreateEventInput) => submitEvent(event?.id, input),
    onSuccess: () => {
      toast.success(isEdit ? 'Changes saved.' : 'Created.');
      onOpenChange(false);
      reset();
      router.refresh();
    },
    onError: () => {
      toast.error(
        isEdit ? 'Something went wrong. Please try again.' : 'Could not create. Please try again.',
      );
    },
  });

  const busy = isSubmitting || mutation.isPending;

  return (
    <FormDialog
      icon={CalendarDays}
      size="lg"
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? 'Edit event' : 'Add event'}
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      submitting={busy}
      dirty={isDirty}
      errorCount={Object.keys(errors).length}
    >
      <FormGroup title="Basics" columns={2}>
        <FormField
          label="Title"
          htmlFor="event-title"
          required
          description="As it should appear on the public Events tab."
          error={errors.title?.message}
        >
          {(fieldProps) => <Input {...fieldProps} {...register('title')} />}
        </FormField>
        <div className="grid gap-2">
          <FormField
            label={showTime ? 'Date and time' : 'Date'}
            htmlFor="event-eventDate"
            required
            description="Institution time (Asia/Bangkok). Future dates list under Upcoming, past ones under Past."
            error={errors.eventDate?.message}
          >
            {(fieldProps) => (
              <Input
                {...fieldProps}
                type={showTime ? 'datetime-local' : 'date'}
                {...register('eventDate')}
              />
            )}
          </FormField>
          <Switch
            checked={showTime}
            onCheckedChange={toggleTime}
            label="Show time"
            description="Leave off when only the day is known; the site then shows the date alone."
            disabled={busy}
            className="-mx-3"
          />
        </div>
      </FormGroup>

      <FormGroup title="Text">
        <FormField
          label="Card summary"
          htmlFor="event-description"
          required
          description="A line or two for the event card."
          error={errors.description?.message}
        >
          {(fieldProps) => <Textarea {...fieldProps} {...register('description')} rows={3} />}
        </FormField>
        <FormField
          label="Full write-up"
          htmlFor="event-content"
          description="Optional. Shown only in Show Details, so the card stays one size however long this gets."
          error={errors.content?.message}
        >
          {(fieldProps) => (
            <Textarea
              {...fieldProps}
              {...register('content', {
                setValueAs: (value: string) => (value.trim() === '' ? null : value),
              })}
              rows={8}
            />
          )}
        </FormField>
      </FormGroup>

      <FormGroup
        title="Card cover"
        description="The photo at the top of the event card, cropped to fit it. Without a cover of its own, the card uses the first gallery photo."
      >
        <CoverField
          coverPhotoUrl={coverPhotoUrl}
          coverCrop={coverCrop}
          photoUrls={photoUrls}
          endpoint="/api/admin/events/photo"
          disabled={busy}
          onChange={(next) => {
            setValue('coverPhotoUrl', next.coverPhotoUrl, { shouldDirty: true });
            setValue('coverCrop', next.coverCrop, { shouldDirty: true });
          }}
        />
      </FormGroup>

      <FormGroup
        title="Gallery"
        description="Shown whole in Show Details. Drag photos in, or upload them."
      >
        <GalleryField
          urls={photoUrls}
          endpoint="/api/admin/events/photo"
          firstIsCover={!coverPhotoUrl}
          disabled={busy}
          onChange={(next) =>
            setValue('photoUrls', next, { shouldDirty: true, shouldValidate: true })
          }
        />
        {errors.photoUrls && (
          <p role="alert" className="text-xs font-medium text-destructive">
            {errors.photoUrls.message}
          </p>
        )}
      </FormGroup>

      <FormGroup
        title="YouTube"
        description="Links to YouTube videos; they play inside Show Details."
      >
        <VideoLinkList
          ids={videoUrls}
          disabled={busy}
          onChange={(next) =>
            setValue('videoUrls', next, { shouldDirty: true, shouldValidate: true })
          }
        />
        {errors.videoUrls && (
          <p role="alert" className="text-xs font-medium text-destructive">
            {errors.videoUrls.message}
          </p>
        )}
      </FormGroup>
    </FormDialog>
  );
}
