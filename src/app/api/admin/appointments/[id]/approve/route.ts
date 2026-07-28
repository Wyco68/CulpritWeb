import type { NextRequest } from 'next/server';
import { getAppointmentService, toAppointmentView } from '@/modules/appointments';
import { requireAdmin } from '@/modules/auth';
import { mapResult } from '@/modules/shared/lib/result';
import { apiError, apiUnexpected, respond } from '@/modules/shared/lib/api-response';

// Admin: pending → approved.
export async function POST(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return apiError(admin.error);

    const { id } = await ctx.params;
    const result = await getAppointmentService().approve(id, `admin:${admin.data.userId}`);
    return respond(mapResult(result, toAppointmentView));
  } catch (error) {
    return apiUnexpected(error);
  }
}
