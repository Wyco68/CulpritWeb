import { beforeEach, describe, expect, it, vi } from 'vitest';

const getProfile = vi.fn();
const env = vi.hoisted(() => ({ CRON_SECRET: 'a'.repeat(32) as string | undefined }));

vi.mock('@/modules/profile', () => ({ getProfileService: () => ({ getProfile }) }));
vi.mock('@/modules/shared/lib/env.server', () => ({ env }));

const { GET } = await import('../route');
const { ok, err } = await import('@/modules/shared/lib/result');
const { InternalError } = await import('@/modules/shared/lib/errors');

const call = (authorization?: string) =>
  GET(
    new Request('http://localhost/api/cron/keep-alive', {
      headers: authorization ? { authorization } : {},
    }),
  );

beforeEach(() => {
  getProfile.mockReset();
  env.CRON_SECRET = 'a'.repeat(32);
});

describe('GET /api/cron/keep-alive', () => {
  it('reads the database and returns ok for the cron secret', async () => {
    getProfile.mockResolvedValueOnce(ok({ labName: 'Lab' }));

    const res = await call(`Bearer ${'a'.repeat(32)}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, data: { status: 'ok' } });
    expect(getProfile).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['no header', undefined],
    ['a wrong secret', `Bearer ${'b'.repeat(32)}`],
    ['a secret of a different length', 'Bearer short'],
  ])('refuses %s without touching the database', async (_, authorization) => {
    const res = await call(authorization);
    expect(res.status).toBe(401);
    expect(getProfile).not.toHaveBeenCalled();
  });

  it('refuses everything when CRON_SECRET is not configured', async () => {
    env.CRON_SECRET = undefined;
    const res = await call('Bearer undefined');
    expect(res.status).toBe(401);
    expect(getProfile).not.toHaveBeenCalled();
  });

  it('reports a database failure as a 500 so the cron run shows as failed', async () => {
    getProfile.mockResolvedValueOnce(err(new InternalError('db unavailable')));
    const res = await call(`Bearer ${'a'.repeat(32)}`);
    expect(res.status).toBe(500);
  });
});
