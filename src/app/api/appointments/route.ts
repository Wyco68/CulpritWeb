import type { NextRequest } from 'next/server';
import {
  getAppointmentService,
  createAppointmentRequestSchema,
  toAppointmentOwnerView,
} from '@/modules/appointments';
import { guardPublicWrite } from '@/modules/integrations';
import { mapResult } from '@/modules/shared/lib/result';
import { apiError, apiUnexpected, apiValidationError, respond } from '@/modules/shared/lib/api-response';

// Public: create a free-form meeting request → pending. Turnstile + rate-limit protected.
export async function POST(request: NextRequest) {
  try {
    const parsed = createAppointmentRequestSchema.safeParse(await request.json());
    if (!parsed.success) return apiValidationError(parsed.error);

    const guard = await guardPublicWrite({
      headers: request.headers,
      email: parsed.data.requesterEmail,
      route: 'appointments.create',
      turnstileToken: parsed.data.turnstileToken,
    });
    if (!guard.ok) return apiError(guard.error);

    const result = await getAppointmentService().createRequest(parsed.data);
    // Owner view: the originating visitor receives their cancelToken (their self-cancel link).
    return respond(mapResult(result, toAppointmentOwnerView), 201);
  } catch (error) {
    return apiUnexpected(error);
  }
}
