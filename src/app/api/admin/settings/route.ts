import type { NextRequest } from 'next/server';
import { getSettingsService, updateSettingsSchema } from '@/modules/settings';
import { requireAdmin } from '@/modules/auth';
import { apiError, apiUnexpected, apiValidationError, respond } from '@/modules/shared/lib/api-response';
import { readJsonBody } from '@/modules/shared/lib/request';
import { revalidateOn } from '@/modules/shared/lib/revalidate';

// Admin: toggle upcoming-events visibility and/or set the default appointment slot duration.
export async function PUT(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return apiError(admin.error);

    const parsed = updateSettingsSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) return apiValidationError(parsed.error);

    const result = await getSettingsService().updateSettings(parsed.data, `admin:${admin.data.userId}`);
    // Both public surfaces read settings: Upcoming Events gates on the visibility flag, Make
    // Appointment renders the default slot duration.
    return respond(revalidateOn(result, 'events', 'appointment'));
  } catch (error) {
    return apiUnexpected(error);
  }
}
