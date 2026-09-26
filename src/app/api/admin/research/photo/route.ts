import { randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { requireAdmin } from '@/modules/auth';
import { getStorageAdapter, readUploadedPhoto } from '@/modules/integrations';
import { apiError, apiSuccess, apiUnexpected } from '@/modules/shared/lib/api-response';

// Admin: upload one research-card photo. Same contract and random-key policy as the team-member
// and event photo routes; the returned URL is saved on the research row by the ordinary update.

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return apiError(admin.error);

    const photo = await readUploadedPhoto(request);
    if (!photo.ok) return apiError(photo.error);

    // Server-generated key — the client's filename never reaches the object key.
    const key = randomUUID();
    const storage = getStorageAdapter();
    const stored = await storage.upload('research', key, photo.data.bytes, photo.data.contentType);
    if (!stored.ok) return apiError(stored.error);

    return apiSuccess({ url: storage.getPublicUrl('research', key) });
  } catch (error) {
    return apiUnexpected(error);
  }
}
