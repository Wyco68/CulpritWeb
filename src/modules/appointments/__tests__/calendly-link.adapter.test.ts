import { describe, expect, it, vi } from 'vitest';
import { AppointmentCalendlyLinkStore } from '../calendly-link.adapter';
import type { CalendlyLinkRepository } from '../calendly-link.repository';
import type { AppointmentService } from '../appointment.service';
import { ok } from '@/modules/shared/lib/result';
import { ConflictError } from '@/modules/shared/lib/errors';
import type { Appointment } from '../appointment.types';

function makeRepository(overrides: Partial<CalendlyLinkRepository> = {}): CalendlyLinkRepository {
  return {
    findByInviteeUri: vi.fn().mockResolvedValue(null),
    findByEventUri: vi.fn().mockResolvedValue(null),
    createFromCalendly: vi.fn().mockResolvedValue({ id: 'apt_1', status: 'booked' }),
    stampCancelledAt: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeAppointmentService(overrides: Partial<AppointmentService> = {}): AppointmentService {
  return {
    createRequest: vi.fn(),
    createDirect: vi.fn(),
    approve: vi.fn(),
    decline: vi.fn(),
    book: vi.fn(),
    cancelByAdmin: vi.fn().mockResolvedValue(ok({} as Appointment)),
    cancelByToken: vi.fn(),
    list: vi.fn(),
    findById: vi.fn(),
    ...overrides,
  } as unknown as AppointmentService;
}

const link = {
  inviteeUri: 'https://api.calendly.com/scheduled_events/1/invitees/abc',
  eventUri: 'https://api.calendly.com/scheduled_events/1',
  eventTypeUri: 'https://api.calendly.com/event_types/1',
  requesterName: 'Jane Visitor',
  requesterEmail: 'jane@example.com',
  scheduledAt: new Date('2026-09-01T10:00:00Z'),
  meetingUrl: null,
};

describe('AppointmentCalendlyLinkStore.recordBookingCreated', () => {
  it('creates a new appointment when the invitee uri is unseen', async () => {
    const repository = makeRepository();
    const store = new AppointmentCalendlyLinkStore(repository, makeAppointmentService());

    const result = await store.recordBookingCreated(link);
    expect(result).toEqual({ appointmentId: 'apt_1', created: true });
    expect(repository.createFromCalendly).toHaveBeenCalledTimes(1);
  });

  it('is idempotent: a second call with the same invitee uri no-ops', async () => {
    const repository = makeRepository({
      findByInviteeUri: vi.fn().mockResolvedValue({ id: 'apt_1', status: 'booked' }),
    });
    const store = new AppointmentCalendlyLinkStore(repository, makeAppointmentService());

    const result = await store.recordBookingCreated(link);
    expect(result).toEqual({ appointmentId: 'apt_1', created: false });
    expect(repository.createFromCalendly).not.toHaveBeenCalled();
  });
});

describe('AppointmentCalendlyLinkStore.recordBookingCancelled', () => {
  it('routes cancellation through the appointment state machine and stamps cancelledAt', async () => {
    const repository = makeRepository({
      findByInviteeUri: vi.fn().mockResolvedValue({ id: 'apt_1', status: 'booked' }),
    });
    const appointmentService = makeAppointmentService();
    const store = new AppointmentCalendlyLinkStore(repository, appointmentService, () => new Date('2026-09-02T00:00:00Z'));

    const result = await store.recordBookingCancelled(link.inviteeUri, 'Conflict');
    expect(result).toEqual({ appointmentId: 'apt_1', cancelled: true });
    expect(appointmentService.cancelByAdmin).toHaveBeenCalledWith('apt_1', { reason: 'Conflict' }, 'calendly:webhook');
    expect(repository.stampCancelledAt).toHaveBeenCalledWith('apt_1', new Date('2026-09-02T00:00:00Z'));
  });

  it('no-ops when the invitee is unknown locally', async () => {
    const repository = makeRepository({ findByInviteeUri: vi.fn().mockResolvedValue(null) });
    const appointmentService = makeAppointmentService();
    const store = new AppointmentCalendlyLinkStore(repository, appointmentService);

    const result = await store.recordBookingCancelled('unknown-uri', null);
    expect(result).toEqual({ appointmentId: null, cancelled: false });
    expect(appointmentService.cancelByAdmin).not.toHaveBeenCalled();
  });

  it('no-ops when the appointment is already terminal (idempotent replay)', async () => {
    const repository = makeRepository({
      findByInviteeUri: vi.fn().mockResolvedValue({ id: 'apt_1', status: 'cancelled' }),
    });
    const appointmentService = makeAppointmentService();
    const store = new AppointmentCalendlyLinkStore(repository, appointmentService);

    const result = await store.recordBookingCancelled(link.inviteeUri, null);
    expect(result).toEqual({ appointmentId: 'apt_1', cancelled: false });
    expect(appointmentService.cancelByAdmin).not.toHaveBeenCalled();
  });

  it('treats an illegal transition from the service as a safe no-op (no state corruption)', async () => {
    const repository = makeRepository({
      findByInviteeUri: vi.fn().mockResolvedValue({ id: 'apt_1', status: 'pending' }),
    });
    const appointmentService = makeAppointmentService({
      cancelByAdmin: vi.fn().mockResolvedValue({ ok: false, error: new ConflictError('illegal transition') }),
    });
    const store = new AppointmentCalendlyLinkStore(repository, appointmentService);

    const result = await store.recordBookingCancelled(link.inviteeUri, null);
    expect(result).toEqual({ appointmentId: 'apt_1', cancelled: false });
    expect(repository.stampCancelledAt).not.toHaveBeenCalled();
  });
});

describe('AppointmentCalendlyLinkStore.reconcileCancellation (admin-initiated Calendly cancel)', () => {
  it('looks up by event uri, cancels via the state machine, and stamps cancelledAt', async () => {
    const repository = makeRepository({
      findByEventUri: vi.fn().mockResolvedValue({ id: 'apt_1', status: 'booked' }),
    });
    const appointmentService = makeAppointmentService();
    const store = new AppointmentCalendlyLinkStore(repository, appointmentService, () => new Date('2026-09-02T00:00:00Z'));

    const result = await store.reconcileCancellation(link.eventUri, 'Admin cancelled');
    expect(result).toEqual({ appointmentId: 'apt_1', cancelled: true });
    expect(repository.findByEventUri).toHaveBeenCalledWith(link.eventUri);
    expect(appointmentService.cancelByAdmin).toHaveBeenCalledWith(
      'apt_1',
      { reason: 'Admin cancelled' },
      'calendly:admin-cancel',
    );
    expect(repository.stampCancelledAt).toHaveBeenCalledWith('apt_1', new Date('2026-09-02T00:00:00Z'));
  });

  it('no-ops when no local appointment is linked to that event uri', async () => {
    const repository = makeRepository({ findByEventUri: vi.fn().mockResolvedValue(null) });
    const appointmentService = makeAppointmentService();
    const store = new AppointmentCalendlyLinkStore(repository, appointmentService);

    const result = await store.reconcileCancellation('https://api.calendly.com/scheduled_events/unknown', null);
    expect(result).toEqual({ appointmentId: null, cancelled: false });
    expect(appointmentService.cancelByAdmin).not.toHaveBeenCalled();
  });

  it('no-ops when the appointment is already terminal (idempotent)', async () => {
    const repository = makeRepository({
      findByEventUri: vi.fn().mockResolvedValue({ id: 'apt_1', status: 'cancelled' }),
    });
    const appointmentService = makeAppointmentService();
    const store = new AppointmentCalendlyLinkStore(repository, appointmentService);

    const result = await store.reconcileCancellation(link.eventUri, null);
    expect(result).toEqual({ appointmentId: 'apt_1', cancelled: false });
    expect(appointmentService.cancelByAdmin).not.toHaveBeenCalled();
  });
});
