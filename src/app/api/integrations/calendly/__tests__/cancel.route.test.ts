import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

const cancelEvent = vi.fn();
const requireAdmin = vi.fn();

vi.mock('@/modules/integrations', async () => {
  const schema = await import('@/modules/integrations/calendly/calendly.schema');
  return { ...schema, getCalendlyService: () => ({ cancelEvent }) };
});
vi.mock('@/modules/auth', () => ({ requireAdmin: () => requireAdmin() }));

const { POST } = await import('../cancel/route');

function makeRequest(body: unknown) {
  return new NextRequest('https://example.com/api/integrations/calendly/cancel', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('POST /api/integrations/calendly/cancel', () => {
  it('returns 401 when the caller is not an admin', async () => {
    const { UnauthorizedError } = await import('@/modules/shared/lib/errors');
    requireAdmin.mockResolvedValueOnce({ ok: false, error: new UnauthorizedError() });

    const res = await POST(makeRequest({ eventUri: 'https://api.calendly.com/scheduled_events/1' }));
    expect(res.status).toBe(401);
    expect(cancelEvent).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid body (non-Calendly uri)', async () => {
    requireAdmin.mockResolvedValueOnce({ ok: true, data: { userId: 'u1', email: 'admin@example.com' } });

    const res = await POST(makeRequest({ eventUri: 'https://evil.example.com/x' }));
    expect(res.status).toBe(400);
    expect(cancelEvent).not.toHaveBeenCalled();
  });

  it('returns 200 and the cancelled event on success', async () => {
    requireAdmin.mockResolvedValueOnce({ ok: true, data: { userId: 'u1', email: 'admin@example.com' } });
    cancelEvent.mockResolvedValueOnce({
      ok: true,
      data: { uri: 'https://api.calendly.com/scheduled_events/1', status: 'canceled' },
    });

    const res = await POST(
      makeRequest({ eventUri: 'https://api.calendly.com/scheduled_events/1', reason: 'No longer needed' }),
    );
    expect(res.status).toBe(200);
    expect(cancelEvent).toHaveBeenCalledWith('https://api.calendly.com/scheduled_events/1', 'No longer needed');
    const json = await res.json();
    expect(json.data.status).toBe('canceled');
  });
});
