import type { NextRequest } from 'next/server';
import { getCalendlyService, getRateLimiter } from '@/modules/integrations';
import { getClientIp } from '@/modules/shared/lib/request';
import { RateLimitError, ValidationError } from '@/modules/shared/lib/errors';
import { apiError, apiSuccess, apiUnexpected } from '@/modules/shared/lib/api-response';

// Calendly payloads are small (well under 10 KB); reject anything bigger before it is parsed or
// hashed, so an attacker can't force expensive work with an oversized POST.
const MAX_WEBHOOK_BODY_BYTES = 32 * 1024;

// Public, signature-verified webhook receiver. Must read the RAW body — HMAC is computed over the
// exact bytes Calendly sent, so `request.json()` (which re-serializes) would break verification.
// Rate-limited by IP (same limiter as the public appointment routes) and size-capped, both BEFORE
// the body is parsed or the HMAC is computed, since this endpoint has no auth to gate abuse.
// Idempotent by design (see calendly.service.processWebhook / the link store). Returns 200 on
// accepted-or-duplicate, 401 on a bad/missing signature, 400 on a malformed/oversized body,
// 429 when rate-limited.
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers);
    const { success, reset } = await getRateLimiter().limit(`calendly.webhook:${ip}`);
    if (!success) {
      const retryAfter = Math.max(0, Math.ceil((reset - Date.now()) / 1000));
      return apiError(new RateLimitError('Too many requests. Please try again later.', retryAfter));
    }

    // Fast reject on a spoofable but cheap signal before touching the body at all.
    const declaredLength = Number(request.headers.get('content-length') ?? '0');
    if (Number.isFinite(declaredLength) && declaredLength > MAX_WEBHOOK_BODY_BYTES) {
      return apiError(new ValidationError('Webhook payload too large.'));
    }

    const rawBody = await request.text();
    // Re-check the ACTUAL size (content-length can be absent/wrong) before any parsing/HMAC work.
    if (Buffer.byteLength(rawBody, 'utf8') > MAX_WEBHOOK_BODY_BYTES) {
      return apiError(new ValidationError('Webhook payload too large.'));
    }

    const signature = request.headers.get('calendly-webhook-signature');

    const result = await getCalendlyService().processWebhook(rawBody, signature);
    if (!result.ok) return apiError(result.error);

    return apiSuccess(result.data);
  } catch (error) {
    return apiUnexpected(error);
  }
}
