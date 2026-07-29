import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppointmentService, TRANSITIONS } from '../appointment.service';
import type {
  AppointmentRepository,
  CreateAppointmentData,
  ListAppointmentsFilter,
  UpdateAppointmentData,
} from '../appointment.repository';
import type { Appointment, AppointmentNotifier, AuditContext } from '../appointment.types';

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
    return [...this.store.values()].filter(
      (a) => (!filter?.status || a.status === filter.status) && (!filter?.source || a.source === filter.source),
    );
  }

  async createWithAudit(input: { data: CreateAppointmentData; audit: AuditContext }): Promise<Appointment> {
    const id = `apt_${++this.seq}`;
    const now = new Date('2026-08-02T00:00:00Z');
    const appointment: Appointment = {
      id,
      requesterName: input.data.requesterName,
      requesterEmail: input.data.requesterEmail,
      researchGroup: input.data.researchGroup ?? null,
      requestedTime: input.data.requestedTime ?? null,
      topic: input.data.topic ?? null,
      source: input.data.source,
      status: input.data.status,
      calendlyEventRef: input.data.calendlyEventRef ?? null,
      cancelReason: null,
      cancelToken: input.data.cancelToken,
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
      status: input.data.status,
      calendlyEventRef:
        input.data.calendlyEventRef !== undefined ? input.data.calendlyEventRef : current.calendlyEventRef,
      cancelReason: input.data.cancelReason !== undefined ? input.data.cancelReason : current.cancelReason,
      updatedAt: new Date('2026-08-02T01:00:00Z'),
    };
    this.store.set(input.id, updated);
    this.audits.push({ ...input.audit, entityId: input.id });
    return { ...updated };
  }
}

function makeNotifier() {
  return { sendAppointmentEmail: vi.fn().mockResolvedValue(undefined) } satisfies AppointmentNotifier;
}

function build() {
  const repository = new FakeRepository();
  const notifier = makeNotifier();
  const service = createAppointmentService({
    repository,
    notifier,
    generateToken: () => 'fixed-token',
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  });
  return { repository, notifier, service };
}

function seedAppointment(repository: FakeRepository, overrides: Partial<Appointment> = {}): Appointment {
  const base: Appointment = {
    id: 'apt_seed',
    requesterName: 'Dr. Rivera',
    requesterEmail: 'rivera@example.com',
    researchGroup: 'Systems Security',
    requestedTime: new Date('2026-09-01T10:00:00Z'),
    topic: 'Intro call',
    source: 'request',
    status: 'pending',
    calendlyEventRef: null,
    cancelReason: null,
    cancelToken: 'secret-token',
    createdAt: new Date('2026-08-02T00:00:00Z'),
    updatedAt: new Date('2026-08-02T00:00:00Z'),
    ...overrides,
  };
  repository.seed(base);
  return base;
}

describe('TRANSITIONS map', () => {
  it('encodes exactly the spec §7.3 legal moves', () => {
    expect(TRANSITIONS.pending).toEqual({ approve: 'approved', decline: 'declined' });
    expect(TRANSITIONS.approved).toEqual({ book: 'booked', cancel: 'cancelled' });
    expect(TRANSITIONS.booked).toEqual({ cancel: 'cancelled' });
    expect(TRANSITIONS.declined).toEqual({});
    expect(TRANSITIONS.cancelled).toEqual({});
  });
});

describe('appointment creation', () => {
  it('createRequest → pending (source=request), audits + notifies received_request', async () => {
    const { repository, notifier, service } = build();
    const result = await service.createRequest({
      requesterName: 'Dr. Rivera',
      requesterEmail: 'rivera@example.com',
      researchGroup: 'Systems Security',
      requestedTime: new Date('2026-09-01T10:00:00Z'),
      topic: 'Intro call',
      turnstileToken: 'ignored-at-service',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.status).toBe('pending');
    expect(result.data.source).toBe('request');
    expect(result.data.cancelToken).toBe('fixed-token');
    expect(repository.audits.at(-1)?.action).toBe('appointment.create.request');
    expect(notifier.sendAppointmentEmail).toHaveBeenCalledWith('received_request', expect.objectContaining({ status: 'pending' }));
  });

  it('createDirect → booked (source=direct) with calendly ref, notifies received_direct', async () => {
    const { repository, notifier, service } = build();
    const result = await service.createDirect({
      requesterName: 'Dr. Rivera',
      requesterEmail: 'rivera@example.com',
      researchGroup: 'Systems Security',
      calendlyEventRef: 'evt_123',
      requestedTime: new Date('2026-09-01T10:00:00Z'),
      turnstileToken: 'ignored',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.status).toBe('booked');
    expect(result.data.source).toBe('direct');
    expect(result.data.calendlyEventRef).toBe('evt_123');
    expect(repository.audits.at(-1)?.action).toBe('appointment.create.direct');
    expect(notifier.sendAppointmentEmail).toHaveBeenCalledWith('received_direct', expect.objectContaining({ status: 'booked' }));
  });
});

describe('legal transitions', () => {
  it('pending → approved', async () => {
    const { repository, notifier, service } = build();
    seedAppointment(repository, { status: 'pending' });
    const result = await service.approve('apt_seed', 'admin:1');
    expect(result.ok && result.data.status).toBe('approved');
    expect(repository.audits.at(-1)?.action).toBe('appointment.approve');
    expect(notifier.sendAppointmentEmail).toHaveBeenCalledWith('approved', expect.anything());
  });

  it('pending → declined (with reason)', async () => {
    const { repository, notifier, service } = build();
    seedAppointment(repository, { status: 'pending' });
    const result = await service.decline('apt_seed', { reason: 'Out of scope' }, 'admin:1');
    expect(result.ok && result.data.status).toBe('declined');
    expect(result.ok && result.data.cancelReason).toBe('Out of scope');
    expect(notifier.sendAppointmentEmail).toHaveBeenCalledWith('declined', expect.anything());
  });

  it('approved → booked (records calendly ref)', async () => {
    const { repository, notifier, service } = build();
    seedAppointment(repository, { status: 'approved' });
    const result = await service.book('apt_seed', { calendlyEventRef: 'evt_777' }, 'admin:1');
    expect(result.ok && result.data.status).toBe('booked');
    expect(result.ok && result.data.calendlyEventRef).toBe('evt_777');
    expect(notifier.sendAppointmentEmail).toHaveBeenCalledWith('booked', expect.anything());
  });

  it('approved → cancelled', async () => {
    const { repository, service } = build();
    seedAppointment(repository, { status: 'approved' });
    const result = await service.cancelByAdmin('apt_seed', { reason: 'Conflict' }, 'admin:1');
    expect(result.ok && result.data.status).toBe('cancelled');
    expect(result.ok && result.data.cancelReason).toBe('Conflict');
  });

  it('booked → cancelled', async () => {
    const { repository, notifier, service } = build();
    seedAppointment(repository, { status: 'booked' });
    const result = await service.cancelByAdmin('apt_seed', { reason: 'No longer needed' }, 'admin:1');
    expect(result.ok && result.data.status).toBe('cancelled');
    expect(notifier.sendAppointmentEmail).toHaveBeenCalledWith('cancelled', expect.anything());
  });

  it('visitor cancels booked via matching token', async () => {
    const { repository, service } = build();
    seedAppointment(repository, { status: 'booked', cancelToken: 'secret-token' });
    const result = await service.cancelByToken('apt_seed', { cancelToken: 'secret-token' });
    expect(result.ok && result.data.status).toBe('cancelled');
  });
});

describe('illegal transitions → ConflictError (409), no side effects', () => {
  const illegal: {
    name: string;
    status: Appointment['status'];
    run: (s: ReturnType<typeof build>['service']) => Promise<{ ok: boolean; error?: { kind: string } }>;
  }[] = [
    { name: 'book a pending', status: 'pending', run: (s) => s.book('apt_seed', { calendlyEventRef: 'x' }, 'a') },
    { name: 'approve a booked', status: 'booked', run: (s) => s.approve('apt_seed', 'a') },
    { name: 'approve a declined', status: 'declined', run: (s) => s.approve('apt_seed', 'a') },
    { name: 'cancel a declined', status: 'declined', run: (s) => s.cancelByAdmin('apt_seed', { reason: 'x' }, 'a') },
    { name: 'cancel a cancelled', status: 'cancelled', run: (s) => s.cancelByAdmin('apt_seed', { reason: 'x' }, 'a') },
    { name: 'decline an approved', status: 'approved', run: (s) => s.decline('apt_seed', {}, 'a') },
    { name: 'book a booked', status: 'booked', run: (s) => s.book('apt_seed', { calendlyEventRef: 'x' }, 'a') },
  ];

  for (const { name, status, run } of illegal) {
    it(`rejects: ${name}`, async () => {
      const { repository, notifier, service } = build();
      seedAppointment(repository, { status });
      const result = await run(service);
      expect(result.ok).toBe(false);
      expect(result.error?.kind).toBe('conflict');
      expect(repository.updateCalls).toBe(0);
      expect(notifier.sendAppointmentEmail).not.toHaveBeenCalled();
    });
  }
});

describe('not-found and token guards', () => {
  it('transition on missing id → NotFound (404)', async () => {
    const { service } = build();
    const result = await service.approve('missing', 'admin:1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('not_found');
  });

  it('token cancel with wrong token → NotFound, no update', async () => {
    const { repository, notifier, service } = build();
    seedAppointment(repository, { status: 'booked', cancelToken: 'secret-token' });
    const result = await service.cancelByToken('apt_seed', { cancelToken: 'wrong' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('not_found');
    expect(repository.updateCalls).toBe(0);
    expect(notifier.sendAppointmentEmail).not.toHaveBeenCalled();
  });
});

describe('email failure never rolls back a committed transition', () => {
  it('returns ok and persists the new status even if the email throws', async () => {
    const { repository, service } = build();
    seedAppointment(repository, { status: 'pending' });
    // Rebuild service with a throwing notifier.
    const throwingService = createAppointmentService({
      repository,
      notifier: { sendAppointmentEmail: vi.fn().mockRejectedValue(new Error('smtp down')) },
      logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });
    const result = await throwingService.approve('apt_seed', 'admin:1');
    expect(result.ok && result.data.status).toBe('approved');
    expect((await repository.findById('apt_seed'))?.status).toBe('approved');
  });
});
