import type { NextRequest } from 'next/server';
import {
  getAppointmentService,
  createAppointmentSchema,
  listAppointmentsQuerySchema,
  toAppointmentView,
} from '@/modules/appointments';
import { requireAdmin } from '@/modules/auth';
import { mapResult } from '@/modules/shared/lib/result';
import { apiError, apiUnexpected, apiValidationError, respond } from '@/modules/shared/lib/api-response';
import { readJsonBody } from '@/modules/shared/lib/request';
import { revalidateOn } from '@/modules/shared/lib/revalidate';

// Admin: list all appointments, optionally filtered by status.
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

// Admin: declare an appointment directly (source `admin`). The other creation path is a visitor
// completing a Calendly booking, captured by POST /api/appointments/direct — see that route.
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return apiError(admin.error);

    const parsed = createAppointmentSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) return apiValidationError(parsed.error);

    const result = await getAppointmentService().create(parsed.data, `admin:${admin.data.userId}`);
    return respond(mapResult(revalidateOn(result, 'events'), toAppointmentView), 201);
  } catch (error) {
    return apiUnexpected(error);
  }
}
