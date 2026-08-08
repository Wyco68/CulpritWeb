import { describe, expect, it, vi } from 'vitest';
import { createResearchService } from '../research.service';
import type { ResearchRepository } from '../research.repository';
import type { AuditContext, Research } from '../research.types';

class FakeRepository implements ResearchRepository {
  store = new Map<string, Research>();
  audits: (AuditContext & { entityId: string })[] = [];
  private seq = 0;

  seed(research: Research) {
    this.store.set(research.id, { ...research });
  }

  async findById(id: string): Promise<Research | null> {
    const found = this.store.get(id);
    return found ? { ...found } : null;
  }

  async list(): Promise<Research[]> {
    return [...this.store.values()].sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async createWithAudit(input: {
    data: Partial<Research>;
    audit: AuditContext;
  }): Promise<Research> {
    const id = `res_${++this.seq}`;
    const now = new Date('2026-08-05T00:00:00Z');
    const research: Research = {
      id,
      title: input.data.title ?? '',
      summary: input.data.summary ?? '',
      area: input.data.area ?? '',
      link: null,
      sortOrder: input.data.sortOrder ?? 0,
      createdAt: now,
      updatedAt: now,
    };
    this.store.set(id, research);
    this.audits.push({ ...input.audit, entityId: id });
    return { ...research };
  }

  async updateWithAudit(input: {
    id: string;
    data: Partial<Research>;
    audit: AuditContext;
  }): Promise<Research> {
    const current = this.store.get(input.id);
    if (!current) throw new Error('not found');
    const updated: Research = { ...current, ...input.data, updatedAt: new Date('2026-08-05T01:00:00Z') };
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
  const service = createResearchService({
    repository,
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  });
  return { repository, service };
}

describe('research service', () => {
  it('create() persists and audits', async () => {
    const { repository, service } = build();
    const result = await service.create(
      { title: 'Malware Analysis', summary: 'Summary', area: 'security', sortOrder: 1 },
      'admin:1',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.title).toBe('Malware Analysis');
    expect(repository.audits.at(-1)?.action).toBe('research.create');
  });

  it('list() returns entries ordered by sortOrder', async () => {
    const { repository, service } = build();
    repository.seed({
      id: 'a',
      title: 'B',
      summary: 's',
      area: 'x',
      link: null,
      sortOrder: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    repository.seed({
      id: 'b',
      title: 'A',
      summary: 's',
      area: 'x',
      link: null,
      sortOrder: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const result = await service.list();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.map((r) => r.id)).toEqual(['b', 'a']);
  });

  it('update() on a missing id returns NotFoundError, no write', async () => {
    const { repository, service } = build();
    const result = await service.update('missing', { title: 'X' }, 'admin:1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('not_found');
    expect(repository.audits).toHaveLength(0);
  });

  it('remove() returns the pre-delete snapshot and audits', async () => {
    const { repository, service } = build();
    repository.seed({
      id: 'a',
      title: 'B',
      summary: 's',
      area: 'x',
      link: null,
      sortOrder: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const result = await service.remove('a', 'admin:1');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.id).toBe('a');
    expect(repository.audits.at(-1)?.action).toBe('research.delete');
    expect(await repository.findById('a')).toBeNull();
  });

  it('remove() on a missing id returns NotFoundError', async () => {
    const { service } = build();
    const result = await service.remove('missing', 'admin:1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('not_found');
  });
});
