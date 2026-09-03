'use client';

import { useFormContext } from 'react-hook-form';
import { PhotoUpload } from '@/modules/shared/ui/photo-upload';

/**
 * Only the two keys this control reads. Deliberately narrower than any one form's value type:
 * the field is mounted by `ProfileFieldsForm`, whose shape depends on which slice of the profile
 * the surrounding admin screen owns.
 */
type PhotoFormValues = { photoUrl?: string | null; fullName?: string };

/**
 * Replaces pasting a photo URL: the admin picks a file, it uploads immediately to object storage,
 * and the resulting URL is written into the form's `photoUrl` field — the admin never sees or
 * types a URL. Upload happens out-of-band from the surrounding profile form's own submit;
 * `photoUrl` just becomes part of the next regular save.
 *
 * The upload mechanics live in `PhotoUpload`, shared with the team-member dialog; this wrapper is
 * only the binding to the surrounding profile form's context.
 */
export function PhotoUploadField() {
  const { watch, setValue } = useFormContext<PhotoFormValues>();

  return (
    <PhotoUpload
      value={watch('photoUrl')}
      onChange={(url) => setValue('photoUrl', url, { shouldDirty: true, shouldValidate: true })}
      endpoint="/api/admin/profile/photo"
      personName={watch('fullName') || ''}
      className="sm:col-span-2"
    />
  );
}
