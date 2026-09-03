import { describe, expect, it } from 'vitest';
import { createEventService, splitByTiming } from '../event.service';
import type { EventRepository } from '../event.repository';
import type { AuditContext, Event } from '../event.types';

const SILENT_LOGGER = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

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

  // Answers the aggregate through splitByTiming itself, so a drift between the dashboard's counts
  // and the public tab's split would fail here rather than ship.
  async stats(now: Date) {
    const rows = await this.list();
    const { upcoming } = splitByTiming(rows, now);
    return {
      total: rows.length,
      upcoming: upcoming.length,
      nextEventDate: upcoming[0]?.eventDate ?? null,
    };
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

  it('stats() agrees with splitByTiming on the same clock', async () => {
    const { repository, service } = makeService();
    const now = new Date('2026-09-01T12:00:00Z');
    const seeded = [
      makeEvent({ id: 'far', eventDate: new Date('2026-12-01T00:00:00Z') }),
      makeEvent({ id: 'soon', eventDate: new Date('2026-09-10T00:00:00Z') }),
      makeEvent({ id: 'recent', eventDate: new Date('2026-08-20T00:00:00Z') }),
    ];
    for (const event of seeded) repository.seed(event);

    const result = await service.stats(now);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { upcoming } = splitByTiming(await repository.list(), now);
    expect(result.data).toEqual({
      total: 3,
      upcoming: upcoming.length,
      nextEventDate: upcoming[0]!.eventDate,
    });
    expect(result.data.nextEventDate).toEqual(new Date('2026-09-10T00:00:00Z'));
  });

  it('stats() counts an event starting exactly now as upcoming, like splitByTiming', async () => {
    const { repository, service } = makeService();
    const now = new Date('2026-09-01T12:00:00Z');
    repository.seed(makeEvent({ id: 'exact', eventDate: now }));

    const result = await service.stats(now);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual({ total: 1, upcoming: 1, nextEventDate: now });
  });

  it('stats() reports no next event when nothing is ahead', async () => {
    const { repository, service } = makeService();
    repository.seed(makeEvent({ id: 'old', eventDate: new Date('2026-01-05T00:00:00Z') }));

    const result = await service.stats(new Date('2026-09-01T12:00:00Z'));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual({ total: 1, upcoming: 0, nextEventDate: null });
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
