'use client';

import { useId, useRef, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { Loader2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar } from '@/modules/shared/ui/avatar';
import { Button } from '@/modules/shared/ui/button';
import { Label } from '@/modules/shared/ui/label';
import type { UpdateProfileInput } from '../profile.schema';

const ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp,image/gif';

async function uploadPhoto(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch('/api/admin/profile/photo', { method: 'POST', body: formData });
  const body = await response.json();
  if (!body.ok) throw new Error(body.error?.message ?? 'Upload failed');
  return (body.data as { url: string }).url;
}

/**
 * Replaces pasting a photo URL: the admin picks a file, it uploads immediately to Supabase
 * Storage, and the resulting URL is written into the form's `photoUrl` field — the admin never
 * sees or types a URL. Upload happens out-of-band from the surrounding profile form's own submit;
 * `photoUrl` just becomes part of the next regular save.
 */
export function PhotoUploadField() {
  const { watch, setValue } = useFormContext<UpdateProfileInput>();
  const photoUrl = watch('photoUrl');
  const fullName = watch('fullName') || '';
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const inputId = useId();

  const initials = fullName
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
      const url = await uploadPhoto(file);
      setValue('photoUrl', url, { shouldDirty: true, shouldValidate: true });
    } catch {
      toast.error('Could not upload the photo. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 sm:col-span-2">
      <Label htmlFor={inputId}>Photo</Label>
      <div className="flex items-center gap-4">
        <Avatar
          src={photoUrl}
          alt={`Portrait of ${fullName || 'the professor'}`}
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
                <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              ) : (
                <Upload className="size-4" aria-hidden="true" />
              )}
              {photoUrl ? 'Change photo' : 'Upload photo'}
            </Button>
            {photoUrl && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => setValue('photoUrl', undefined, { shouldDirty: true, shouldValidate: true })}
              >
                <X className="size-4" aria-hidden="true" />
                Remove
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">JPEG, PNG, WebP or GIF. 5 MB max.</p>
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
  );
}
