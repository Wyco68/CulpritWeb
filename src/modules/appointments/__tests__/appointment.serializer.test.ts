import { describe, expect, it } from 'vitest';
import { toAppointmentView } from '../appointment.serializer';
import type { Appointment } from '../appointment.types';

const appointment: Appointment = {
  id: 'apt_1',
  requesterName: 'Dr. Rivera',
  requesterEmail: 'rivera@example.com',
  researchGroup: 'Systems Security',
  scheduledAt: new Date('2026-09-01T10:00:00Z'),
  topic: 'Intro call',
  status: 'scheduled',
  cancelReason: null,
  createdAt: new Date('2026-08-02T00:00:00Z'),
  updatedAt: new Date('2026-08-02T00:00:00Z'),
};

describe('toAppointmentView', () => {
  it('passes the appointment through unchanged (no secret fields exist to hide)', () => {
    const view = toAppointmentView(appointment);
    expect(view).toEqual(appointment);
  });
});
