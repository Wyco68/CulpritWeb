import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

const update = vi.fn();
const remove = vi.fn();
const requireAdmin = vi.fn();

vi.mock('@/modules/research', async () => {
  const schema = await import('@/modules/research/research.schema');
  return { ...schema, getResearchService: () => ({ update, remove }) };
});
vi.mock('@/modules/auth', () => ({ requireAdmin: () => requireAdmin() }));
vi.mock('@/modules/shared/lib/revalidate', () => ({ revalidateOn: (result: unknown) => result }));

const { PUT, DELETE } = await import('../[id]/route');

const ADMIN = { ok: true, data: { userId: 'u1', email: 'admin@example.com' } };
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

function putRequest(body: unknown) {
  return new NextRequest('https://example.com/api/admin/research/x', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

// The `id` arrives as a path param, so it is a request boundary like any other and gets the same
// server-side Zod check. Without it a blank or oversized id reached the repository as a lookup.
describe('admin research [id] route id validation', () => {
  it('rejects a blank id before reaching the service', async () => {
    requireAdmin.mockResolvedValueOnce(ADMIN);

    const res = await PUT(putRequest({ title: 'Fine' }), ctx('   '));

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('validation_error');
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects an over-long id on delete', async () => {
    requireAdmin.mockResolvedValueOnce(ADMIN);

    const res = await DELETE(putRequest({}), ctx('a'.repeat(201)));

    expect(res.status).toBe(400);
    expect(remove).not.toHaveBeenCalled();
  });

  it('checks admin before the id, so an anonymous caller still gets 401', async () => {
    const { UnauthorizedError } = await import('@/modules/shared/lib/errors');
    requireAdmin.mockResolvedValueOnce({ ok: false, error: new UnauthorizedError() });

    const res = await DELETE(putRequest({}), ctx('   '));

    expect(res.status).toBe(401);
    expect(remove).not.toHaveBeenCalled();
  });

  it('passes the trimmed id through on a valid request', async () => {
    requireAdmin.mockResolvedValueOnce(ADMIN);
    const { ok } = await import('@/modules/shared/lib/result');
    remove.mockResolvedValueOnce(ok({ id: 'res_1' }));

    const res = await DELETE(putRequest({}), ctx('  res_1  '));

    expect(res.status).toBe(200);
    expect(remove).toHaveBeenCalledWith('res_1', 'admin:u1');
  });
});
