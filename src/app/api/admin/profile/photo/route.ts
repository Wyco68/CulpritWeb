import type { NextRequest } from 'next/server';
import { requireAdmin } from '@/modules/auth';
import { getStorageAdapter } from '@/modules/integrations';
import { apiError, apiSuccess, apiUnexpected } from '@/modules/shared/lib/api-response';
import { ValidationError } from '@/modules/shared/lib/errors';

// Admin: upload the profile photo. Replaces pasting a photo URL — the admin never needs to know
// or manage a storage host; they pick a file and this returns the URL the profile form saves.
//
// Fixed object key ("avatar", no extension): the profile is a singleton with exactly one photo,
// so every upload overwrites the same object (upsert) rather than accumulating orphaned files
// under different names. The real content type is still passed to the storage adapter, so the
// object serves with the correct Content-Type header regardless of the (extension-less) key.
// Vercel caps a serverless function's request body at 4.5 MB, and rejects anything larger at the
// platform edge — before this handler runs, so the admin would get an opaque 413 instead of the
// message below. The cap is set under that ceiling so the app's own validation is what the admin
// actually sees. Raising it means moving uploads to a presigned direct-to-R2 PUT, where the file
// never passes through a function at all.
const MAX_PHOTO_BYTES = 4 * 1024 * 1024; // 4 MB — see the Vercel body limit above
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return apiError(admin.error);

    const formData = await request.formData().catch(() => null);
    const file = formData?.get('file');
    if (!(file instanceof File)) {
      return apiError(new ValidationError('No photo was uploaded.', { file: ['Required'] }));
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return apiError(
        new ValidationError('Unsupported file type. Use JPEG, PNG, WebP or GIF.', {
          file: ['Unsupported file type.'],
        }),
      );
    }
    if (file.size > MAX_PHOTO_BYTES) {
      return apiError(
        new ValidationError('Photo is too large (4 MB max).', { file: ['Photo is too large (4 MB max).'] }),
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await getStorageAdapter().upload('profile', 'avatar', buffer, file.type);
    if (!result.ok) return apiError(result.error);

    // Cache-bust: the object's public URL is otherwise identical on every upload (fixed key), so
    // a browser (or CDN) that already cached the old image would keep showing it. The timestamp
    // becomes part of the stored `photoUrl` itself once the admin saves the form.
    const publicUrl = getStorageAdapter().getPublicUrl('profile', 'avatar');
    const url = `${publicUrl}?v=${Date.now()}`;

    return apiSuccess({ url });
  } catch (error) {
    return apiUnexpected(error);
  }
}
