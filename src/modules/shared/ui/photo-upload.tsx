'use client';

import { useId, useRef, useState } from 'react';
import { Loader2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar } from '@/modules/shared/ui/avatar';
import { Button } from '@/modules/shared/ui/button';
import { Label } from '@/modules/shared/ui/label';

// The file-picker photo control, shared by the profile form and the team-member dialog. Both need
// the identical behaviour — pick a file, upload it out-of-band, write the resulting URL into the
// surrounding form — so the mechanics live here once and each caller supplies its own endpoint and
// form wiring. This component is deliberately controlled and form-library-agnostic: it takes a
// value and an onChange, so a caller using `useFormContext` and a caller using a plain `useForm`
// both fit without this file knowing which.

const ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp,image/gif';

async function uploadPhoto(endpoint: string, file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(endpoint, { method: 'POST', body: formData });
  const body = await response.json();
  if (!body.ok) throw new Error(body.error?.message ?? 'Upload failed');
  return (body.data as { url: string }).url;
}

export interface PhotoUploadProps {
  /** Current photo URL, or null/undefined when there is none. */
  value: string | null | undefined;
  /**
   * Receives the new URL, or `null` when the photo is removed. `null` rather than `undefined` is
   * deliberate: these forms serialize to JSON, where an undefined key simply vanishes from the
   * body — which the update routes read as "leave the column alone", so a removal would silently
   * do nothing.
   */
  onChange: (url: string | null) => void;
  /** Admin upload route that returns `{ url }`. */
  endpoint: string;
  /** Name the photo depicts — used for the preview's alt text and initials fallback. */
  personName?: string;
  label?: string;
  /** `sm:col-span-2` in the two-column profile form; the dialog uses the default single column. */
  className?: string;
}

export function PhotoUpload({
  value,
  onChange,
  endpoint,
  personName = '',
  label = 'Photo',
  className,
}: PhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const inputId = useId();

  const initials = personName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ''; // allow re-selecting the same file later
    if (!file) return;

    setUploading(true);
    try {
      onChange(await uploadPhoto(endpoint, file));
    } catch {
      toast.error('Could not upload the photo. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className={className}>
      <div className="flex flex-col gap-2">
        <Label htmlFor={inputId}>{label}</Label>
        <div className="flex items-center gap-4">
          <Avatar
            src={value}
            alt={personName ? `Portrait of ${personName}` : 'Photo preview'}
            fallback={initials || '?'}
            size="lg"
          />
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => inputRef.current?.click()}
              >
                {uploading ? (
                  <Loader2
                    className="size-4 animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                ) : (
                  <Upload className="size-4" aria-hidden="true" />
                )}
                {value ? 'Change photo' : 'Upload photo'}
              </Button>
              {value && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  onClick={() => onChange(null)}
                >
                  <X className="size-4" aria-hidden="true" />
                  Remove
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">JPEG, PNG, WebP or GIF. 4 MB max.</p>
          </div>
        </div>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={ACCEPTED_TYPES}
          className="sr-only"
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
}
