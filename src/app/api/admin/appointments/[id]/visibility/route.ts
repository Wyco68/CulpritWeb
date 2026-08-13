import type { NextRequest } from 'next/server';
import {
  getAppointmentService,
  updateAppointmentVisibilitySchema,
  toAppointmentView,
} from '@/modules/appointments';
import { requireAdmin } from '@/modules/auth';
import { mapResult } from '@/modules/shared/lib/result';
import { apiError, apiUnexpected, apiValidationError, respond } from '@/modules/shared/lib/api-response';
import { revalidateOn } from '@/modules/shared/lib/revalidate';
import { readJsonBody } from '@/modules/shared/lib/request';

// Admin: toggle whether an appointment appears on the public Upcoming Events tab (`isPublic`).
// No status restriction — a cancelled appointment can still be flipped, though the public
// Upcoming Events query only ever surfaces `scheduled` rows.
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return apiError(admin.error);

    const { id } = await ctx.params;
    const parsed = updateAppointmentVisibilitySchema.safeParse(await readJsonBody(request));
    if (!parsed.success) return apiValidationError(parsed.error);

    const result = await getAppointmentService().updateVisibility(
      id,
      parsed.data,
      `admin:${admin.data.userId}`,
    );
    return respond(mapResult(revalidateOn(result, 'events'), toAppointmentView));
  } catch (error) {
    return apiUnexpected(error);
  }
}
