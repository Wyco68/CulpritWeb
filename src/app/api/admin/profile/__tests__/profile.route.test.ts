import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

// Boundary contract for the admin profile routes. The service is mocked: what is under test here
// is auth -> validate -> one service call -> standardized envelope, nothing below it.

const updateProfile = vi.fn();
const patchProfile = vi.fn();
const requireAdmin = vi.fn();

vi.mock('@/modules/profile', async () => {
  const schema = await import('@/modules/profile/profile.schema');
  return { ...schema, getProfileService: () => ({ updateProfile, patchProfile }) };
});
vi.mock('@/modules/auth', () => ({ requireAdmin: () => requireAdmin() }));

const { PATCH, PUT } = await import('../route');

function makeRequest(method: 'PATCH' | 'PUT', body: unknown) {
  return new NextRequest('https://example.com/api/admin/profile', {
    method,
    body: JSON.stringify(body),
  });
}

function asAdmin() {
  requireAdmin.mockResolvedValueOnce({ ok: true, data: { userId: 'u1', email: 'admin@example.com' } });
}

const PROFILE = {
  id: 'profile_1',
  fullName: 'Dr. Cavallaro',
  title: 'Professor',
  photoUrl: null,
  bio: null,
  positionAffiliation: null,
  researchStatement: null,
  linkedinUrl: null,
  googleScholarUrl: null,
  calendlyUrl: null,
  publicationsIntro: null,
  teachingIntro: 'Courses I teach.',
  teamIntro: null,
  eventsIntro: null,
  appointmentIntro: null,
  updatedAt: new Date('2026-09-02T00:00:00Z'),
};

describe('PATCH /api/admin/profile', () => {
  it('returns 401 when the caller is not an admin', async () => {
    const { UnauthorizedError } = await import('@/modules/shared/lib/errors');
    requireAdmin.mockResolvedValueOnce({ ok: false, error: new UnauthorizedError() });

    const res = await PATCH(makeRequest('PATCH', { teachingIntro: 'x' }));
    expect(res.status).toBe(401);
    expect(patchProfile).not.toHaveBeenCalled();
  });

  it('returns 400 for an empty patch', async () => {
    asAdmin();
    const res = await PATCH(makeRequest('PATCH', {}));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe('validation_error');
    expect(patchProfile).not.toHaveBeenCalled();
  });

  it('returns 400 with a field error for an invalid calendlyUrl', async () => {
    asAdmin();
    const res = await PATCH(makeRequest('PATCH', { calendlyUrl: 'not-a-url' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.fieldErrors.calendlyUrl).toBeDefined();
    expect(patchProfile).not.toHaveBeenCalled();
  });

  it('returns 200 and passes only the supplied fields to the service', async () => {
    asAdmin();
    const { ok } = await import('@/modules/shared/lib/result');
    patchProfile.mockResolvedValueOnce(ok(PROFILE));

    const res = await PATCH(makeRequest('PATCH', { teachingIntro: 'Courses I teach.' }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.teachingIntro).toBe('Courses I teach.');
    expect(patchProfile).toHaveBeenCalledWith({ teachingIntro: 'Courses I teach.' }, 'admin:u1');
  });
});

describe('PUT /api/admin/profile', () => {
  it('still accepts the whole document (backward compatible)', async () => {
    asAdmin();
    const { ok } = await import('@/modules/shared/lib/result');
    updateProfile.mockResolvedValueOnce(ok(PROFILE));

    const res = await PUT(makeRequest('PUT', { fullName: 'Dr. Cavallaro', title: 'Professor' }));

    expect(res.status).toBe(200);
    expect(updateProfile).toHaveBeenCalledWith(
      { fullName: 'Dr. Cavallaro', title: 'Professor' },
      'admin:u1',
    );
  });
});
