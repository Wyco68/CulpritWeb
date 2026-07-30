import { createHmac } from 'node:crypto';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const processWebhook = vi.fn();
const rateLimit = vi.fn().mockResolvedValue({ success: true, remaining: 10, reset: Date.now() + 1000 });

vi.mock('@/modules/integrations', () => ({
  getCalendlyService: () => ({ processWebhook }),
  getRateLimiter: () => ({ limit: rateLimit }),
}));

const { POST } = await import('../webhook/route');

function makeRequest(body: string, signature: string | null, extraHeaders: Record<string, string> = {}) {
  return new NextRequest('https://example.com/api/integrations/calendly/webhook', {
    method: 'POST',
    body,
    headers: {
      ...(signature ? { 'calendly-webhook-signature': signature } : {}),
      ...extraHeaders,
    },
  });
}

describe('POST /api/integrations/calendly/webhook', () => {
  beforeEach(() => {
    processWebhook.mockReset();
    rateLimit.mockReset().mockResolvedValue({ success: true, remaining: 10, reset: Date.now() + 1000 });
  });

  it('reads the raw body and forwards it + the signature header to the service', async () => {
    processWebhook.mockResolvedValueOnce({ ok: true, data: { event: 'invitee.created', handled: true, duplicate: false } });
    const body = JSON.stringify({ event: 'invitee.created' });
    const req = makeRequest(body, 't=1,v1=abc');

    const res = await POST(req);
    const json = await res.json();

    expect(processWebhook).toHaveBeenCalledWith(body, 't=1,v1=abc');
    expect(res.status).toBe(200);
    expect(json).toEqual({ ok: true, data: { event: 'invitee.created', handled: true, duplicate: false } });
  });

  it('returns 401 when the service rejects the signature', async () => {
    const { UnauthorizedError } = await import('@/modules/shared/lib/errors');
    processWebhook.mockResolvedValueOnce({ ok: false, error: new UnauthorizedError('Invalid webhook signature.') });
    const req = makeRequest('{}', 'garbage');

    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.ok).toBe(false);
  });

  it('returns 400 on a malformed body reported by the service', async () => {
    const { ValidationError } = await import('@/modules/shared/lib/errors');
    processWebhook.mockResolvedValueOnce({ ok: false, error: new ValidationError('Malformed webhook body.') });
    const req = makeRequest('not json', signHeader('not json'));

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 429 and never touches the service when the IP is rate-limited', async () => {
    rateLimit.mockResolvedValueOnce({ success: false, remaining: 0, reset: Date.now() + 30_000 });
    const req = makeRequest('{}', 't=1,v1=abc');

    const res = await POST(req);
    expect(res.status).toBe(429);
    expect(processWebhook).not.toHaveBeenCalled();
  });

  it('rejects an oversized body with 400 before calling the service (declared content-length)', async () => {
    const oversized = 'x'.repeat(64 * 1024);
    const req = makeRequest(oversized, 't=1,v1=abc', { 'content-length': String(oversized.length) });

    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(processWebhook).not.toHaveBeenCalled();
  });
});

function signHeader(body: string) {
  const t = Math.floor(Date.now() / 1000);
  const v1 = createHmac('sha256', 'unused').update(`${t}.${body}`).digest('hex');
  return `t=${t},v1=${v1}`;
}
