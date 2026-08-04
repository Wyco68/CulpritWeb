import { describe, expect, it, vi } from 'vitest';
import { createProfileService } from '../profile.service';
import type { ProfileRepository } from '../profile.repository';
import type { Profile } from '../profile.types';

const BLANK: Profile = {
  id: 'profile_1',
  fullName: '',
  title: '',
  photoUrl: null,
  bio: null,
  positionAffiliation: null,
  education: null,
  fellowshipsVisiting: null,
  teachingRoles: null,
  teachingAwards: null,
  scholarshipsTravelAwards: null,
  researchInterests: null,
  researchStatement: null,
  invitedTalks: null,
  updatedAt: new Date('2026-08-02T00:00:00Z'),
};

class FakeRepository implements ProfileRepository {
  current: Profile = { ...BLANK };
  audits: { actor: string; action: string }[] = [];

  async get(): Promise<Profile> {
    return { ...this.current };
  }

  async updateWithAudit(input: {
    data: Partial<Profile>;
    audit: { actor: string; action: string };
  }): Promise<Profile> {
    this.current = { ...this.current, ...input.data, updatedAt: new Date('2026-08-02T01:00:00Z') };
    this.audits.push(input.audit);
    return { ...this.current };
  }
}

function build() {
  const repository = new FakeRepository();
  const service = createProfileService({
    repository,
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  });
  return { repository, service };
}

describe('profile service', () => {
  it('getProfile returns the singleton row', async () => {
    const { service } = build();
    const result = await service.getProfile();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.fullName).toBe('');
  });

  it('updateProfile persists changes and writes an audit entry', async () => {
    const { repository, service } = build();
    const result = await service.updateProfile(
      { fullName: 'Dr. Cavallaro', title: 'Professor of Information Security' },
      'admin:1',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.fullName).toBe('Dr. Cavallaro');
    expect(repository.audits.at(-1)).toEqual({ actor: 'admin:1', action: 'profile.update' });
  });

  it('surfaces a repository failure as an AppError result', async () => {
    const { repository, service } = build();
    repository.get = vi.fn().mockRejectedValue(new Error('db down'));
    const result = await service.getProfile();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('internal');
  });
});
