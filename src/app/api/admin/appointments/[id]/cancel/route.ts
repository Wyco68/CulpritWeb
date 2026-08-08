import type { NextRequest } from 'next/server';
import { getAppointmentService, cancelAppointmentSchema, toAppointmentView } from '@/modules/appointments';
import { requireAdmin } from '@/modules/auth';
import { mapResult } from '@/modules/shared/lib/result';
import { apiError, apiUnexpected, apiValidationError, respond } from '@/modules/shared/lib/api-response';
import { revalidateOn } from '@/modules/shared/lib/revalidate';
import { readJsonBody } from '@/modules/shared/lib/request';

// Admin: scheduled → cancelled (+ required reason). Record retained, never deleted.
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return apiError(admin.error);

    const { id } = await ctx.params;
    const parsed = cancelAppointmentSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) return apiValidationError(parsed.error);

    const result = await getAppointmentService().cancel(id, parsed.data, `admin:${admin.data.userId}`);
    return respond(mapResult(revalidateOn(result, 'events'), toAppointmentView));
  } catch (error) {
    return apiUnexpected(error);
  }
}
