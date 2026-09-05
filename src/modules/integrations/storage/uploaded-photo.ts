import type { NextRequest } from 'next/server';
import { ValidationError } from '@/modules/shared/lib/errors';
import { err, ok, type Result } from '@/modules/shared/lib/result';

// One place for the photo-upload policy the three admin upload routes (profile, event, team
// member) share. They differ only in which bucket and object key they write to; what counts as an
// acceptable photo must not drift between them.

/**
 * Vercel caps a serverless function's request body at 4.5 MB and rejects anything larger at the
 * platform edge — before the handler runs — so the admin would get an opaque 413 instead of the
 * message below. This cap sits under that ceiling, which is what makes the app's own validation
 * the thing the admin actually sees. Raising it means moving uploads to a presigned direct-to-R2
 * PUT, where the file never passes through a function at all.
 */
const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

/** Validated photo bytes, ready to hand to the storage adapter. */
export type UploadedPhoto = { bytes: Buffer; contentType: string };

/** Read and validate the multipart `file` field of an admin photo upload. */
export async function readUploadedPhoto(request: NextRequest): Promise<Result<UploadedPhoto>> {
  const formData = await request.formData().catch(() => null);
  const file = formData?.get('file');

  if (!(file instanceof File)) {
    return err(new ValidationError('No photo was uploaded.', { file: ['Required'] }));
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return err(
      new ValidationError('Unsupported file type. Use JPEG, PNG, WebP or GIF.', {
        file: ['Unsupported file type.'],
      }),
    );
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return err(
      new ValidationError('Photo is too large (4 MB max).', {
        file: ['Photo is too large (4 MB max).'],
      }),
    );
  }

  return ok({ bytes: Buffer.from(await file.arrayBuffer()), contentType: file.type });
}
