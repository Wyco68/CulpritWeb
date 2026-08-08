import { z } from 'zod';
import type { NextRequest } from 'next/server';
import { getTurnstileVerifier, getRateLimiter } from '@/modules/integrations';
import { getClientIp, readJsonBody } from '@/modules/shared/lib/request';
import { RateLimitError } from '@/modules/shared/lib/errors';
import { apiError, apiSuccess, apiUnexpected, apiValidationError } from '@/modules/shared/lib/api-response';

const verifyTurnstileSchema = z.object({ token: z.string().trim().min(1) });

// Public: confirm a Turnstile token before the caller reveals a bot-sensitive UI (currently: the
// Calendly embed on the public Make Appointment page — see turnstile-challenge.tsx). Not a form
// submission endpoint; nothing is written. Server-side siteverify is mandatory — the client
// widget alone proves nothing, per the verifier's own header comment.
export async function POST(request: NextRequest) {
  try {
    const parsed = verifyTurnstileSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) return apiValidationError(parsed.error);

    const ip = getClientIp(request.headers);
    const { success, reset } = await getRateLimiter().limit(`turnstile.verify:${ip}`);
    if (!success) {
      const retryAfter = Math.max(0, Math.ceil((reset - Date.now()) / 1000));
      return apiError(new RateLimitError('Too many requests. Please try again later.', retryAfter));
    }

    const result = await getTurnstileVerifier().verify(parsed.data.token, ip);
    if (!result.ok) return apiError(result.error);

    return apiSuccess({ verified: true });
  } catch (error) {
    return apiUnexpected(error);
  }
}
