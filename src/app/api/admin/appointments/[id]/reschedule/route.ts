import type { NextRequest } from 'next/server';
import {
  getAppointmentService,
  rescheduleAppointmentSchema,
  toAppointmentView,
} from '@/modules/appointments';
import { requireAdmin } from '@/modules/auth';
import { mapResult } from '@/modules/shared/lib/result';
import { apiError, apiUnexpected, apiValidationError, respond } from '@/modules/shared/lib/api-response';
import { revalidateOn } from '@/modules/shared/lib/revalidate';
import { readJsonBody } from '@/modules/shared/lib/request';

// Admin: scheduled → scheduled (reschedule) — changes `scheduledAt` only. 409 if the appointment
// isn't currently scheduled (e.g. already cancelled).
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return apiError(admin.error);

    const { id } = await ctx.params;
    const parsed = rescheduleAppointmentSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) return apiValidationError(parsed.error);

    const result = await getAppointmentService().reschedule(
      id,
      parsed.data,
      `admin:${admin.data.userId}`,
    );
    return respond(mapResult(revalidateOn(result, 'events'), toAppointmentView));
  } catch (error) {
    return apiUnexpected(error);
  }
}
