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
    scheduledAt: new Date('2026-09-01T10:00:00Z'),
    topic: 'Intro call',
    status: 'scheduled',
    cancelReason: null,
    isPublic: true,
    createdAt: new Date('2026-08-02T00:00:00Z'),
    updatedAt: new Date('2026-08-02T00:00:00Z'),
    ...overrides,
  };
}

function makeAppointmentService(list: ReturnType<typeof vi.fn>): AppointmentService {
  return {
    create: vi.fn(),
    update: vi.fn(),
    cancel: vi.fn(),
    reschedule: vi.fn(),
    updateVisibility: vi.fn(),
    delete: vi.fn(),
    list,
  };
}

describe('upcoming events service', () => {
  it('queries scheduled, public appointments from now', async () => {
    const events = [makeAppointment(), makeAppointment({ id: 'apt_2' })];
    const listMock = vi.fn().mockResolvedValue(ok(events));
    const now = new Date('2026-08-05T12:00:00Z');
    const service = createUpcomingEventsService({
      appointmentService: makeAppointmentService(listMock),
      now: () => now,
    });

    const result = await service.getUpcomingEvents();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.events).toHaveLength(2);
    }
    expect(listMock).toHaveBeenCalledWith({ status: 'scheduled', fromTime: now, isPublic: true });
  });

  it('returns an empty list when nothing is opted into public visibility', async () => {
    const listMock = vi.fn().mockResolvedValue(ok([]));
    const service = createUpcomingEventsService({
      appointmentService: makeAppointmentService(listMock),
    });

    const result = await service.getUpcomingEvents();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.events).toEqual([]);
  });

  it('propagates a repository/service failure', async () => {
    const { err } = await import('@/modules/shared/lib/result');
    const { InternalError } = await import('@/modules/shared/lib/errors');
    const listMock = vi.fn().mockResolvedValue(err(new InternalError('db down')));
    const service = createUpcomingEventsService({
      appointmentService: makeAppointmentService(listMock),
    });

    const result = await service.getUpcomingEvents();
    expect(result.ok).toBe(false);
  });
});
