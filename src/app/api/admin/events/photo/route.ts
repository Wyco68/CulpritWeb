import { randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { requireAdmin } from '@/modules/auth';
import { getStorageAdapter } from '@/modules/integrations';
import { apiError, apiSuccess, apiUnexpected } from '@/modules/shared/lib/api-response';
import { ValidationError } from '@/modules/shared/lib/errors';

// Admin: upload one event photo. Same contract as the profile-photo route (multipart `file`, JSON
// `{ url }` back), with one deliberate difference: the object key is a fresh random id per upload
// rather than a fixed name.
//
// The profile has exactly one photo, so overwriting a fixed `avatar` key is correct there. An
// event has a gallery of up to 20, and they are created and removed independently — a fixed key
// would make every upload clobber the last. A random key also means no cache-busting query string
// is needed: a new object is a new URL.
//
// Removing a photo from an event only drops the URL from the row; the object stays in R2. That is
// a deliberate trade for a single-admin site on a 10 GB free tier — a delete-on-removal path would
// have to be transactional with the row update to avoid orphaning live URLs, and orphaned objects
// are the cheaper failure. Revisit if storage ever becomes the binding constraint.
const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB
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
        new ValidationError('Photo is too large (5 MB max).', {
          file: ['Photo is too large (5 MB max).'],
        }),
      );
    }

    // Server-generated key — the client's filename is never used, so there is nothing
    // user-controlled in the object key at all.
    const key = randomUUID();
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await getStorageAdapter().upload('events', key, buffer, file.type);
    if (!result.ok) return apiError(result.error);

    return apiSuccess({ url: getStorageAdapter().getPublicUrl('events', key) });
  } catch (error) {
    return apiUnexpected(error);
  }
}
