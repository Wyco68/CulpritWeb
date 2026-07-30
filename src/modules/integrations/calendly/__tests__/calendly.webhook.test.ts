import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyWebhookSignature } from '../calendly.webhook';

const SIGNING_KEY = 'test-signing-key';
const NOW_MS = new Date('2026-08-03T00:00:00Z').getTime();

function signedHeader(body: string, tSeconds: number, key = SIGNING_KEY): string {
  const hmac = createHmac('sha256', key).update(`${tSeconds}.${body}`).digest('hex');
  return `t=${tSeconds},v1=${hmac}`;
}

describe('verifyWebhookSignature', () => {
  const body = JSON.stringify({ event: 'invitee.created' });
  const tSeconds = Math.floor(NOW_MS / 1000);

  it('accepts a validly signed payload', () => {
    const header = signedHeader(body, tSeconds);
    const result = verifyWebhookSignature(body, header, SIGNING_KEY, { now: () => NOW_MS });
    expect(result).toEqual({ valid: true });
  });

  it('rejects a missing header', () => {
    const result = verifyWebhookSignature(body, null, SIGNING_KEY, { now: () => NOW_MS });
    expect(result).toEqual({ valid: false, reason: 'missing_header' });
  });

  it('rejects a malformed header', () => {
    const result = verifyWebhookSignature(body, 'not-a-real-header', SIGNING_KEY, { now: () => NOW_MS });
    expect(result).toEqual({ valid: false, reason: 'malformed_header' });
  });

  it('rejects a signature computed with the wrong key', () => {
    const header = signedHeader(body, tSeconds, 'wrong-key');
    const result = verifyWebhookSignature(body, header, SIGNING_KEY, { now: () => NOW_MS });
    expect(result).toEqual({ valid: false, reason: 'signature_mismatch' });
  });

  it('rejects a signature computed over a different body (tamper detection)', () => {
    const header = signedHeader(body, tSeconds);
    const tampered = JSON.stringify({ event: 'invitee.canceled' });
    const result = verifyWebhookSignature(tampered, header, SIGNING_KEY, { now: () => NOW_MS });
    expect(result).toEqual({ valid: false, reason: 'signature_mismatch' });
  });

  it('rejects a timestamp outside the tolerance window (replay protection)', () => {
    const staleT = tSeconds - 10 * 60; // 10 minutes old, default tolerance is 5 minutes
    const header = signedHeader(body, staleT);
    const result = verifyWebhookSignature(body, header, SIGNING_KEY, { now: () => NOW_MS });
    expect(result).toEqual({ valid: false, reason: 'timestamp_out_of_tolerance' });
  });
});
