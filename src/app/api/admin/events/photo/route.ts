import { randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { requireAdmin } from '@/modules/auth';
import { getStorageAdapter, readUploadedPhoto } from '@/modules/integrations';
import { apiError, apiSuccess, apiUnexpected } from '@/modules/shared/lib/api-response';

// Admin: upload one event photo. Same contract as the profile-photo route (multipart `file` in,
// JSON `{ url }` out) with one deliberate difference: a fresh random object key per upload.
//
// An event has a gallery of up to 20 photos, created and removed independently, so the profile's
// fixed `avatar` key would make every upload clobber the last. A random key also removes the need
// for a cache-busting query string — a new object is a new URL.
//
// Removing a photo from an event only drops the URL from the row; the object stays in R2. That is
// a deliberate trade for a single-admin site on a 10 GB free tier — a delete-on-removal path would
// have to be transactional with the row update to avoid orphaning live URLs, and orphaned objects
// are the cheaper failure. Revisit if storage ever becomes the binding constraint.

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return apiError(admin.error);

    const photo = await readUploadedPhoto(request);
    if (!photo.ok) return apiError(photo.error);

    // Server-generated key — the client's filename is never used, so nothing user-controlled ends
    // up in the object key.
    const key = randomUUID();
    const storage = getStorageAdapter();
    const stored = await storage.upload('events', key, photo.data.bytes, photo.data.contentType);
    if (!stored.ok) return apiError(stored.error);

    return apiSuccess({ url: storage.getPublicUrl('events', key) });
  } catch (error) {
    return apiUnexpected(error);
  }
}
