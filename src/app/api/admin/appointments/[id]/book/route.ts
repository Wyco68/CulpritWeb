import type { NextRequest } from 'next/server';
import { getAppointmentService, adminBookSchema, toAppointmentView } from '@/modules/appointments';
import { requireAdmin } from '@/modules/auth';
import { mapResult } from '@/modules/shared/lib/result';
import { apiError, apiUnexpected, apiValidationError, respond } from '@/modules/shared/lib/api-response';
import { readJsonBody } from '@/modules/shared/lib/request';

// Admin: approved → booked (+ required calendly_event_ref).
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return apiError(admin.error);

    const { id } = await ctx.params;
    const parsed = adminBookSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) return apiValidationError(parsed.error);

    const result = await getAppointmentService().book(id, parsed.data, `admin:${admin.data.userId}`);
    return respond(mapResult(result, toAppointmentView));
  } catch (error) {
    return apiUnexpected(error);
  }
}
