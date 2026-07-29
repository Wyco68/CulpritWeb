import { describe, expect, it } from 'vitest';
import { toAppointmentOwnerView, toAppointmentView } from '../appointment.serializer';
import type { Appointment } from '../appointment.types';

const appointment: Appointment = {
  id: 'apt_1',
  requesterName: 'Dr. Rivera',
  requesterEmail: 'rivera@example.com',
  researchGroup: 'Systems Security',
  requestedTime: new Date('2026-09-01T10:00:00Z'),
  topic: 'Intro call',
  source: 'request',
  status: 'pending',
  calendlyEventRef: null,
  cancelReason: null,
  cancelToken: 'super-secret-token',
  createdAt: new Date('2026-08-02T00:00:00Z'),
  updatedAt: new Date('2026-08-02T00:00:00Z'),
};

describe('appointment serializers', () => {
  it('toAppointmentView omits the cancelToken (admin/list/transition responses)', () => {
    const view = toAppointmentView(appointment);
    expect('cancelToken' in view).toBe(false);
    expect(JSON.stringify(view)).not.toContain('super-secret-token');
    expect(view.id).toBe('apt_1');
  });

  it('toAppointmentOwnerView keeps the cancelToken (create response to the visitor)', () => {
    const view = toAppointmentOwnerView(appointment);
    expect(view.cancelToken).toBe('super-secret-token');
  });
});
