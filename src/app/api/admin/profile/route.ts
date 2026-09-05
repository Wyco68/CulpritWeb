import type { NextRequest } from 'next/server';
import { getProfileService, patchProfileSchema, updateProfileSchema } from '@/modules/profile';
import { requireAdmin } from '@/modules/auth';
import {
  apiError,
  apiUnexpected,
  apiValidationError,
  respond,
} from '@/modules/shared/lib/api-response';
import { revalidateOn } from '@/modules/shared/lib/revalidate';
import { readJsonBody } from '@/modules/shared/lib/request';

// Admin: replace the structured bio/profile (singleton). Audit-logged.
export async function PUT(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return apiError(admin.error);

    const parsed = updateProfileSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) return apiValidationError(parsed.error);

    const result = await getProfileService().updateProfile(
      parsed.data,
      `admin:${admin.data.userId}`,
    );
    return respond(revalidateOn(result, 'profile'));
  } catch (error) {
    return apiUnexpected(error);
  }
}

// Admin: update SOME profile fields, leaving the rest untouched. Audit-logged with the changed
// field names. Used by the per-tab admin screens, each of which owns a slice of the singleton —
// a whole-document PUT from one screen would blank the fields owned by the others.
export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return apiError(admin.error);

    const parsed = patchProfileSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) return apiValidationError(parsed.error);

    const result = await getProfileService().patchProfile(
      parsed.data,
      `admin:${admin.data.userId}`,
    );
    return respond(revalidateOn(result, 'profile'));
  } catch (error) {
    return apiUnexpected(error);
  }
}
