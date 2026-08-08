import { describe, expect, it, vi } from 'vitest';
import { createAppointmentService } from '../appointment.service';
import type {
  AppointmentRepository,
  CreateAppointmentData,
  ListAppointmentsFilter,
  UpdateAppointmentData,
} from '../appointment.repository';
import type { Appointment, AuditContext } from '../appointment.types';

// In-memory fake repository. Records audit entries + tracks update calls so tests can assert that
// illegal transitions produce NO side effects.
class FakeRepository implements AppointmentRepository {
  store = new Map<string, Appointment>();
  audits: (AuditContext & { entityId: string })[] = [];
  updateCalls = 0;
  private seq = 0;

  seed(appointment: Appointment) {
    this.store.set(appointment.id, { ...appointment });
  }

  async findById(id: string): Promise<Appointment | null> {
    const found = this.store.get(id);
    return found ? { ...found } : null;
  }

  async list(filter?: ListAppointmentsFilter): Promise<Appointment[]> {
    return [...this.store.values()].filter((a) => !filter?.status || a.status === filter.status);
  }

  async createWithAudit(input: { data: CreateAppointmentData; audit: AuditContext }): Promise<Appointment> {
    const id = `apt_${++this.seq}`;
    const now = new Date('2026-08-02T00:00:00Z');
    const appointment: Appointment = {
      id,
      requesterName: input.data.requesterName,
      requesterEmail: input.data.requesterEmail ?? null,
      researchGroup: input.data.researchGroup ?? null,
      scheduledAt: input.data.scheduledAt,
      topic: input.data.topic ?? null,
      status: 'scheduled',
      cancelReason: null,
      createdAt: now,
      updatedAt: now,
    };
    this.store.set(id, appointment);
    this.audits.push({ ...input.audit, entityId: id });
    return { ...appointment };
  }

  async updateWithAudit(input: {
    id: string;
    data: UpdateAppointmentData;
    audit: AuditContext;
  }): Promise<Appointment> {
    this.updateCalls++;
    const current = this.store.get(input.id);
    if (!current) throw new Error('not found');
    const updated: Appointment = {
      ...current,
      requesterName: input.data.requesterName ?? current.requesterName,
      requesterEmail: input.data.requesterEmail !== undefined ? input.data.requesterEmail : current.requesterEmail,
      researchGroup: input.data.researchGroup !== undefined ? input.data.researchGroup : current.researchGroup,
      scheduledAt: input.data.scheduledAt ?? current.scheduledAt,
      topic: input.data.topic !== undefined ? input.data.topic : current.topic,
      status: input.data.status ?? current.status,
      cancelReason: input.data.cancelReason !== undefined ? input.data.cancelReason : current.cancelReason,
      updatedAt: new Date('2026-08-02T01:00:00Z'),
    };
    this.store.set(input.id, updated);
    this.audits.push({ ...input.audit, entityId: input.id });
    return { ...updated };
  }
}

function build() {
  const repository = new FakeRepository();
  const service = createAppointmentService({
    repository,
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  });
  return { repository, service };
}

function seedAppointment(repository: FakeRepository, overrides: Partial<Appointment> = {}): Appointment {
  const base: Appointment = {
    id: 'apt_seed',
    requesterName: 'Dr. Rivera',
    requesterEmail: 'rivera@example.com',
    researchGroup: 'Systems Security',
    scheduledAt: new Date('2026-09-01T10:00:00Z'),
    topic: 'Intro call',
    status: 'scheduled',
    cancelReason: null,
    createdAt: new Date('2026-08-02T00:00:00Z'),
    updatedAt: new Date('2026-08-02T00:00:00Z'),
    ...overrides,
  };
  repository.seed(base);
  return base;
}

describe('create', () => {
  it('declares an appointment as scheduled, audited', async () => {
    const { repository, service } = build();
    const result = await service.create(
      {
        requesterName: 'Dr. Rivera',
        requesterEmail: 'rivera@example.com',
        researchGroup: 'Systems Security',
        scheduledAt: new Date('2026-09-01T10:00:00Z'),
        topic: 'Intro call',
      },
      'admin:1',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.status).toBe('scheduled');
    expect(repository.audits.at(-1)?.action).toBe('appointment.create');
  });

  it('succeeds with no requesterEmail (admin may not have it on hand)', async () => {
    const { service } = build();
    const result = await service.create(
      { requesterName: 'Walk-in visitor', scheduledAt: new Date('2026-09-01T10:00:00Z') },
      'admin:1',
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.requesterEmail).toBeNull();
  });
});

describe('update', () => {
  it('edits a scheduled appointment', async () => {
    const { repository, service } = build();
    seedAppointment(repository);
    const result = await service.update('apt_seed', { topic: 'Rescheduled intro call' }, 'admin:1');
    expect(result.ok && result.data.topic).toBe('Rescheduled intro call');
  });

  it('rejects editing a cancelled appointment → 409, no side effects', async () => {
    const { repository, service } = build();
    seedAppointment(repository, { status: 'cancelled' });
    const result = await service.update('apt_seed', { topic: 'x' }, 'admin:1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('conflict');
    expect(repository.updateCalls).toBe(0);
  });
});

describe('cancel', () => {
  it('scheduled → cancelled, records reason', async () => {
    const { repository, service } = build();
    seedAppointment(repository);
    const result = await service.cancel('apt_seed', { reason: 'No longer needed' }, 'admin:1');
    expect(result.ok && result.data.status).toBe('cancelled');
    expect(result.ok && result.data.cancelReason).toBe('No longer needed');
  });

  it('rejects cancelling an already-cancelled appointment → 409, no side effects', async () => {
    const { repository, service } = build();
    seedAppointment(repository, { status: 'cancelled' });
    const result = await service.cancel('apt_seed', { reason: 'x' }, 'admin:1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('conflict');
    expect(repository.updateCalls).toBe(0);
  });

  it('transition on missing id → NotFound (404)', async () => {
    const { service } = build();
    const result = await service.cancel('missing', { reason: 'x' }, 'admin:1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('not_found');
  });
});
