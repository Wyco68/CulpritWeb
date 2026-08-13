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

// Admin: hard-delete an appointment. Audited (full before-state) before the row is removed — an
// explicit admin action, available alongside (not instead of) soft cancel. No status restriction.
export async function DELETE(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return apiError(admin.error);

    const { id } = await ctx.params;
    const result = await getAppointmentService().delete(id, `admin:${admin.data.userId}`);
    return respond(revalidateOn(result, 'events'));
  } catch (error) {
    return apiUnexpected(error);
  }
}
