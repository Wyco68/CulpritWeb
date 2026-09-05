import type { NextRequest } from 'next/server';
import { requireAdmin } from '@/modules/auth';
import { getStorageAdapter, readUploadedPhoto } from '@/modules/integrations';
import { apiError, apiSuccess, apiUnexpected } from '@/modules/shared/lib/api-response';

// Admin: upload the profile photo. The admin picks a file and this returns the URL the profile
// form saves — they never see or manage a storage host.
//
// Fixed object key ("avatar", no extension): the profile is a singleton with exactly one photo, so
// every upload overwrites the same object rather than accumulating orphans under different names.
// The real content type still reaches the storage adapter, so the object serves with the correct
// Content-Type header regardless of the extension-less key.

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return apiError(admin.error);

    const photo = await readUploadedPhoto(request);
    if (!photo.ok) return apiError(photo.error);

    const storage = getStorageAdapter();
    const stored = await storage.upload(
      'profile',
      'avatar',
      photo.data.bytes,
      photo.data.contentType,
    );
    if (!stored.ok) return apiError(stored.error);

    // Cache-bust: the fixed key means the public URL is identical on every upload, so a browser
    // (or CDN) holding the old image would keep showing it. The timestamp becomes part of the
    // stored `photoUrl` once the admin saves the form.
    const url = `${storage.getPublicUrl('profile', 'avatar')}?v=${Date.now()}`;
    return apiSuccess({ url });
  } catch (error) {
    return apiUnexpected(error);
  }
}
