import { createHmac, timingSafeEqual } from 'node:crypto';

// Calendly signs webhooks like Stripe: the `Calendly-Webhook-Signature` header is
//   t=<unix_timestamp>,v1=<hex_hmac_sha256>
// where the HMAC is computed over `<timestamp>.<raw_request_body>` using the subscription's
// signing key. We verify over the RAW body (never a re-serialized object) and compare in
// constant time. An optional timestamp tolerance blunts replay of very old signed payloads.

const DEFAULT_TOLERANCE_SECONDS = 5 * 60; // 300s

export interface WebhookVerifyResult {
  valid: boolean;
  /** Safe reason code for logging when invalid (never includes secrets). */
  reason?: 'missing_header' | 'malformed_header' | 'timestamp_out_of_tolerance' | 'signature_mismatch';
}

function parseHeader(header: string): { t?: string; v1?: string } {
  const out: { t?: string; v1?: string } = {};
  for (const part of header.split(',')) {
    const [key, value] = part.split('=');
    if (key === 't') out.t = value?.trim();
    if (key === 'v1') out.v1 = value?.trim();
  }
  return out;
}

function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length === 0 || bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Verify a Calendly signed webhook.
 * @param rawBody   the exact request body bytes as a string (do NOT re-stringify parsed JSON)
 * @param header    the `Calendly-Webhook-Signature` header value
 * @param signingKey the subscription signing key (CALENDLY_WEBHOOK_SIGNING_KEY)
 * @param now       injectable clock (ms) for deterministic tests
 */
export function verifyWebhookSignature(
  rawBody: string,
  header: string | null,
  signingKey: string,
  options: { toleranceSeconds?: number; now?: () => number } = {},
): WebhookVerifyResult {
  if (!header) return { valid: false, reason: 'missing_header' };

  const { t, v1 } = parseHeader(header);
  if (!t || !v1 || !/^\d+$/.test(t)) return { valid: false, reason: 'malformed_header' };

  const tolerance = options.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  const nowSeconds = Math.floor((options.now?.() ?? Date.now()) / 1000);
  if (Math.abs(nowSeconds - Number.parseInt(t, 10)) > tolerance) {
    return { valid: false, reason: 'timestamp_out_of_tolerance' };
  }

  const expected = createHmac('sha256', signingKey).update(`${t}.${rawBody}`).digest('hex');
  if (!safeEqualHex(expected, v1)) return { valid: false, reason: 'signature_mismatch' };

  return { valid: true };
}
