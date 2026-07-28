import type { NextRequest } from 'next/server';
import { getAppointmentService, adminDeclineSchema, toAppointmentView } from '@/modules/appointments';
import { requireAdmin } from '@/modules/auth';
import { mapResult } from '@/modules/shared/lib/result';
import { apiError, apiUnexpected, apiValidationError, respond } from '@/modules/shared/lib/api-response';

// Admin: pending → declined (reason optional).
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return apiError(admin.error);

    const { id } = await ctx.params;
    const body = await request.json().catch(() => ({}));
    const parsed = adminDeclineSchema.safeParse(body ?? {});
    if (!parsed.success) return apiValidationError(parsed.error);

    const result = await getAppointmentService().decline(id, parsed.data, `admin:${admin.data.userId}`);
    return respond(mapResult(result, toAppointmentView));
  } catch (error) {
    return apiUnexpected(error);
  }
}
