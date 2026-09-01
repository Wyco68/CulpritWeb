import { describe, expect, it } from 'vitest';
import { createEventService, splitByTiming } from '../event.service';
import type { EventRepository } from '../event.repository';
import type { AuditContext, Event } from '../event.types';

const SILENT_LOGGER = { info: () => {}, warn: () => {}, error: () => {} };

function makeEvent(overrides: Partial<Event> = {}): Event {
  const now = new Date('2026-09-01T00:00:00Z');
  return {
    id: 'evt_1',
    title: 'Guest lecture',
    description: 'A talk.',
    eventDate: new Date('2026-10-14T04:00:00Z'),
    photoUrls: [],
    videoUrls: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

class FakeRepository implements EventRepository {
  store = new Map<string, Event>();
  audits: (AuditContext & { entityId: string })[] = [];
  private seq = 0;

  seed(event: Event) {
    this.store.set(event.id, { ...event });
  }

  async findById(id: string): Promise<Event | null> {
    const found = this.store.get(id);
    return found ? { ...found } : null;
  }

  async list(): Promise<Event[]> {
    return [...this.store.values()].sort(
      (a, b) => b.eventDate.getTime() - a.eventDate.getTime(),
    );
  }

  async createWithAudit(input: { data: Partial<Event>; audit: AuditContext }): Promise<Event> {
    const id = `evt_${++this.seq}`;
    const event = makeEvent({ ...input.data, id });
    this.store.set(id, event);
    this.audits.push({ ...input.audit, entityId: id });
    return { ...event };
  }

  async updateWithAudit(input: {
    id: string;
    data: Partial<Event>;
    audit: AuditContext;
  }): Promise<Event> {
    const current = this.store.get(input.id);
    if (!current) throw new Error('not found');
    const updated = { ...current, ...input.data };
    this.store.set(input.id, updated);
    this.audits.push({ ...input.audit, entityId: input.id });
    return { ...updated };
  }

  async deleteWithAudit(input: { id: string; audit: AuditContext }): Promise<void> {
    this.store.delete(input.id);
    this.audits.push({ ...input.audit, entityId: input.id });
  }
}

function makeService() {
  const repository = new FakeRepository();
  const service = createEventService({ repository, logger: SILENT_LOGGER });
  return { repository, service };
}

describe('event service', () => {
  it('creates an event and writes an audit entry', async () => {
    const { repository, service } = makeService();

    const result = await service.create(
      {
        title: 'Workshop',
        description: 'Hands-on.',
        eventDate: new Date('2026-11-02T07:00:00Z'),
      },
      'admin:1',
    );

    expect(result.ok).toBe(true);
    expect(repository.audits).toHaveLength(1);
    expect(repository.audits[0]).toMatchObject({ actor: 'admin:1', action: 'event.create' });
  });

  it('rejects an update to an id that does not exist', async () => {
    const { service } = makeService();

    const result = await service.update('missing', { title: 'x' }, 'admin:1');

    expect(result.ok).toBe(false);
  });

  it('records the full before-state when deleting', async () => {
    const { repository, service } = makeService();
    repository.seed(
      makeEvent({ id: 'evt_9', title: 'Panel', photoUrls: ['https://cdn.example.org/a.jpg'] }),
    );

    const result = await service.remove('evt_9', 'admin:1');

    expect(result.ok).toBe(true);
    expect(repository.store.has('evt_9')).toBe(false);
    expect(repository.audits[0]).toMatchObject({
      action: 'event.delete',
      metadata: { title: 'Panel', photoUrls: ['https://cdn.example.org/a.jpg'] },
    });
  });

  it('refuses to delete an id that does not exist', async () => {
    const { service } = makeService();

    const result = await service.remove('missing', 'admin:1');

    expect(result.ok).toBe(false);
  });
});

describe('splitByTiming', () => {
  const now = new Date('2026-09-01T12:00:00Z');
  // Newest-first, the order the repository returns.
  const events = [
    makeEvent({ id: 'far', eventDate: new Date('2026-12-01T00:00:00Z') }),
    makeEvent({ id: 'soon', eventDate: new Date('2026-09-10T00:00:00Z') }),
    makeEvent({ id: 'recent', eventDate: new Date('2026-08-20T00:00:00Z') }),
    makeEvent({ id: 'old', eventDate: new Date('2026-01-05T00:00:00Z') }),
  ];

  it('puts the soonest upcoming event first and the most recent past event first', () => {
    const { upcoming, past } = splitByTiming(events, now);

    expect(upcoming.map((e) => e.id)).toEqual(['soon', 'far']);
    expect(past.map((e) => e.id)).toEqual(['recent', 'old']);
  });

  it('counts an event starting exactly now as upcoming', () => {
    const { upcoming, past } = splitByTiming([makeEvent({ id: 'exact', eventDate: now })], now);

    expect(upcoming.map((e) => e.id)).toEqual(['exact']);
    expect(past).toEqual([]);
  });

  it('handles an empty list', () => {
    expect(splitByTiming([], now)).toEqual({ upcoming: [], past: [] });
  });
});
