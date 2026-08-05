import { describe, expect, it, vi } from 'vitest';
import { createUpcomingEventsService } from '../upcoming-events.service';
import type { AppointmentService } from '../appointment.service';
import type { Appointment } from '../appointment.types';
import { ok } from '@/modules/shared/lib/result';

function makeAppointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: 'apt_1',
    requesterName: 'Dr. Rivera',
    requesterEmail: 'rivera@example.com',
    researchGroup: 'Systems Security',
    requestedTime: new Date('2026-09-01T10:00:00Z'),
    topic: 'Intro call',
    source: 'request',
    status: 'approved',
    calendlyEventRef: null,
    cancelReason: null,
    cancelToken: 'secret-token',
    createdAt: new Date('2026-08-02T00:00:00Z'),
    updatedAt: new Date('2026-08-02T00:00:00Z'),
    ...overrides,
  };
}

function makeAppointmentService(list: ReturnType<typeof vi.fn>): AppointmentService {
  return {
    createRequest: vi.fn(),
    createDirect: vi.fn(),
    approve: vi.fn(),
    decline: vi.fn(),
    book: vi.fn(),
    cancelByAdmin: vi.fn(),
    cancelByToken: vi.fn(),
    list,
  };
}

describe('upcoming events service', () => {
  it('returns visible=false and no events when the setting is off', async () => {
    const listMock = vi.fn();
    const service = createUpcomingEventsService({
      appointmentService: makeAppointmentService(listMock),
      isUpcomingEventsVisible: async () => false,
    });

    const result = await service.getUpcomingEvents();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual({ visible: false, events: [] });
    expect(listMock).not.toHaveBeenCalled();
  });

  it('queries approved+booked appointments from now when the setting is on', async () => {
    const events = [makeAppointment({ status: 'approved' }), makeAppointment({ id: 'apt_2', status: 'booked' })];
    const listMock = vi.fn().mockResolvedValue(ok(events));
    const now = new Date('2026-08-05T12:00:00Z');
    const service = createUpcomingEventsService({
      appointmentService: makeAppointmentService(listMock),
      isUpcomingEventsVisible: async () => true,
      now: () => now,
    });

    const result = await service.getUpcomingEvents();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.visible).toBe(true);
      expect(result.data.events).toHaveLength(2);
    }
    expect(listMock).toHaveBeenCalledWith({ statusIn: ['approved', 'booked'], fromTime: now });
  });

  it('propagates a repository/service failure', async () => {
    const { err } = await import('@/modules/shared/lib/result');
    const { InternalError } = await import('@/modules/shared/lib/errors');
    const listMock = vi.fn().mockResolvedValue(err(new InternalError('db down')));
    const service = createUpcomingEventsService({
      appointmentService: makeAppointmentService(listMock),
      isUpcomingEventsVisible: async () => true,
    });

    const result = await service.getUpcomingEvents();
    expect(result.ok).toBe(false);
  });
});
