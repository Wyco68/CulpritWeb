import { randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { requireAdmin } from '@/modules/auth';
import { getStorageAdapter, readUploadedPhoto } from '@/modules/integrations';
import { apiError, apiSuccess, apiUnexpected } from '@/modules/shared/lib/api-response';

// Admin: upload one team-member photo. Same contract and same random-key policy as the
// event-photo route — see it for why a fixed key would be wrong for a many-photo bucket.

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
    const stored = await storage.upload('team', key, photo.data.bytes, photo.data.contentType);
    if (!stored.ok) return apiError(stored.error);

    return apiSuccess({ url: storage.getPublicUrl('team', key) });
  } catch (error) {
    return apiUnexpected(error);
  }
}
