import type { NextRequest } from 'next/server';
import { getAppointmentService, updateAppointmentSchema, toAppointmentView } from '@/modules/appointments';
import { requireAdmin } from '@/modules/auth';
import { mapResult } from '@/modules/shared/lib/result';
import { apiError, apiUnexpected, apiValidationError, respond } from '@/modules/shared/lib/api-response';
import { readJsonBody } from '@/modules/shared/lib/request';
import { revalidateOn } from '@/modules/shared/lib/revalidate';

// Admin: edit a scheduled appointment's details. 409 if it has already been cancelled.
export async function PUT(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return apiError(admin.error);

    const { id } = await ctx.params;
    const parsed = updateAppointmentSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) return apiValidationError(parsed.error);

    const result = await getAppointmentService().update(id, parsed.data, `admin:${admin.data.userId}`);
    return respond(mapResult(revalidateOn(result, 'events'), toAppointmentView));
  } catch (error) {
    return apiUnexpected(error);
  }
}
