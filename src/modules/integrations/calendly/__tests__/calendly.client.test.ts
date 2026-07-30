import { describe, expect, it, vi } from 'vitest';
import { HttpCalendlyClient } from '../calendly.client';
import { AppError } from '@/modules/shared/lib/errors';

function jsonResponse(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json', ...init.headers },
  });
}

describe('HttpCalendlyClient', () => {
  it('injects the bearer token and default headers', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    const client = new HttpCalendlyClient('secret-token', fetchImpl as unknown as typeof fetch);

    await client.request('/users/me');

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer secret-token');
  });

  it('builds query params, dropping nullish values', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}));
    const client = new HttpCalendlyClient('t', fetchImpl as unknown as typeof fetch);

    await client.request('/scheduled_events', { query: { user: 'u1', status: undefined, count: 5 } });

    const [url] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('user=u1');
    expect(url).toContain('count=5');
    expect(url).not.toContain('status=');
  });

  it('returns the parsed JSON body on success', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ resource: { uri: 'x' } }));
    const client = new HttpCalendlyClient('t', fetchImpl as unknown as typeof fetch);

    const data = await client.request<{ resource: { uri: string } }>('/users/me');
    expect(data.resource.uri).toBe('x');
  });

  it.each([
    [401, 'unauthorized'],
    [403, 'integration'],
    [404, 'not_found'],
    [500, 'integration'],
  ] as const)('maps HTTP %i to a %s AppError without leaking body/token', async (status, kind) => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('secret upstream detail', { status }));
    const client = new HttpCalendlyClient('super-secret-token', fetchImpl as unknown as typeof fetch);

    await expect(client.request('/users/me')).rejects.toMatchObject({ kind });
    // The rejection must never leak the raw token or the upstream body text.
    try {
      await client.request('/users/me');
    } catch (error) {
      const message = (error as AppError).message;
      expect(message).not.toContain('super-secret-token');
      expect(message).not.toContain('secret upstream detail');
    }
  });

  it('maps 429 to a RateLimitError carrying Retry-After', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response('rate limited', { status: 429, headers: { 'retry-after': '30' } }));
    const client = new HttpCalendlyClient('t', fetchImpl as unknown as typeof fetch);

    await expect(client.request('/users/me')).rejects.toMatchObject({
      kind: 'rate_limit',
      retryAfterSeconds: 30,
    });
  });

  it('maps a network failure to an IntegrationError', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('ECONNRESET'));
    const client = new HttpCalendlyClient('t', fetchImpl as unknown as typeof fetch);

    await expect(client.request('/users/me')).rejects.toMatchObject({ kind: 'integration' });
  });
});
