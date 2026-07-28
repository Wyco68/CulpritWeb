import type { NextRequest } from 'next/server';
import { getAppointmentService, cancelByTokenSchema, toAppointmentView } from '@/modules/appointments';
import { getRateLimiter } from '@/modules/integrations';
import { getClientIp } from '@/modules/shared/lib/request';
import { RateLimitError } from '@/modules/shared/lib/errors';
import { mapResult } from '@/modules/shared/lib/result';
import { apiError, apiUnexpected, apiValidationError, respond } from '@/modules/shared/lib/api-response';

// Public (token): visitor self-cancels their own appointment via the unguessable cancel_token.
// The token is the secret, so no Turnstile — but rate-limit by IP to blunt token guessing.
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const parsed = cancelByTokenSchema.safeParse(await request.json());
    if (!parsed.success) return apiValidationError(parsed.error);

    const ip = getClientIp(request.headers);
    const { success, reset } = await getRateLimiter().limit(`appointments.cancel:${ip}`);
    if (!success) {
      const retryAfter = Math.max(0, Math.ceil((reset - Date.now()) / 1000));
      return apiError(new RateLimitError('Too many requests. Please try again later.', retryAfter));
    }

    const result = await getAppointmentService().cancelByToken(id, parsed.data);
    return respond(mapResult(result, toAppointmentView));
  } catch (error) {
    return apiUnexpected(error);
  }
}
