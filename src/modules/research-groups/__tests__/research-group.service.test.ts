import { describe, expect, it, vi } from 'vitest';
import { createResearchGroupService } from '../research-group.service';
import type { ResearchGroupRepository } from '../research-group.repository';
import type { AuditContext, ResearchGroup } from '../research-group.types';

class FakeRepository implements ResearchGroupRepository {
  store = new Map<string, ResearchGroup>();
  audits: (AuditContext & { entityId: string })[] = [];
  private seq = 0;

  seed(group: ResearchGroup) {
    this.store.set(group.id, { ...group });
  }

  async findById(id: string): Promise<ResearchGroup | null> {
    const found = this.store.get(id);
    return found ? { ...found } : null;
  }

  async list(): Promise<ResearchGroup[]> {
    return [...this.store.values()];
  }

  async createWithAudit(input: {
    data: { name: string; description: string };
    audit: AuditContext;
  }): Promise<ResearchGroup> {
    const id = `grp_${++this.seq}`;
    const now = new Date('2026-08-05T00:00:00Z');
    const group: ResearchGroup = {
      id,
      name: input.data.name,
      description: input.data.description,
      teamMembers: [],
      createdAt: now,
      updatedAt: now,
    };
    this.store.set(id, group);
    this.audits.push({ ...input.audit, entityId: id });
    return { ...group };
  }

  async updateWithAudit(input: {
    id: string;
    data: Partial<{ name: string; description: string }>;
    audit: AuditContext;
  }): Promise<ResearchGroup> {
    const current = this.store.get(input.id);
    if (!current) throw new Error('not found');
    const updated: ResearchGroup = {
      ...current,
      ...input.data,
      updatedAt: new Date('2026-08-05T01:00:00Z'),
    };
    this.store.set(input.id, updated);
    this.audits.push({ ...input.audit, entityId: input.id });
    return { ...updated };
  }

  async deleteWithAudit(input: { id: string; audit: AuditContext }): Promise<void> {
    if (!this.store.delete(input.id)) throw new Error('not found');
    this.audits.push({ ...input.audit, entityId: input.id });
  }
}

function build() {
  const repository = new FakeRepository();
  const service = createResearchGroupService({
    repository,
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  });
  return { repository, service };
}

describe('research group service', () => {
  it('create() persists with an empty teamMembers list and audits', async () => {
    const { repository, service } = build();
    const result = await service.create(
      { name: 'Systems Security Lab', description: 'Desc' },
      'admin:1',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.teamMembers).toEqual([]);
    expect(repository.audits.at(-1)?.action).toBe('research_group.create');
  });

  it('update() on a missing id returns NotFoundError', async () => {
    const { service } = build();
    const result = await service.update('missing', { name: 'X' }, 'admin:1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('not_found');
  });

  it('remove() returns the pre-delete snapshot and audits', async () => {
    const { repository, service } = build();
    repository.seed({
      id: 'grp_1',
      name: 'Lab',
      description: 'Desc',
      teamMembers: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const result = await service.remove('grp_1', 'admin:1');
    expect(result.ok).toBe(true);
    expect(repository.audits.at(-1)?.action).toBe('research_group.delete');
  });
});
