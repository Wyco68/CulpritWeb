import type { NextRequest } from 'next/server';
import { getAppointmentService, listAppointmentsQuerySchema, toAppointmentView } from '@/modules/appointments';
import { requireAdmin } from '@/modules/auth';
import { mapResult } from '@/modules/shared/lib/result';
import { apiError, apiUnexpected, apiValidationError, respond } from '@/modules/shared/lib/api-response';

// Admin: list all appointments, optionally filtered by status/source.
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return apiError(admin.error);

    const params = Object.fromEntries(request.nextUrl.searchParams);
    const parsed = listAppointmentsQuerySchema.safeParse(params);
    if (!parsed.success) return apiValidationError(parsed.error);

    const result = await getAppointmentService().list(parsed.data);
    return respond(mapResult(result, (rows) => rows.map(toAppointmentView)));
  } catch (error) {
    return apiUnexpected(error);
  }
}
