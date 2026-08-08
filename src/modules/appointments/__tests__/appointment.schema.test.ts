import { describe, expect, it } from 'vitest';
import {
  cancelAppointmentSchema,
  createAppointmentSchema,
  listAppointmentsQuerySchema,
  updateAppointmentSchema,
} from '../appointment.schema';

describe('createAppointmentSchema', () => {
  it('parses a valid appointment and lowercases the email', () => {
    const result = createAppointmentSchema.safeParse({
      requesterName: 'Dr. Rivera',
      requesterEmail: 'Rivera@Example.COM',
      researchGroup: 'Systems Security',
      scheduledAt: '2026-09-01T10:00:00Z',
      topic: 'Intro call',
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.requesterEmail).toBe('rivera@example.com');
    expect(result.data.scheduledAt).toBeInstanceOf(Date);
  });

  it('strips HTML from free-text fields (sanitization)', () => {
    const result = createAppointmentSchema.safeParse({
      requesterName: 'Dr. <b>Rivera</b>',
      scheduledAt: '2026-09-01T10:00:00Z',
      topic: '<script>alert(1)</script>Malware',
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.requesterName).toBe('Dr. Rivera');
    expect(result.data.topic).toBe('alert(1)Malware');
  });

  it('requesterEmail is optional — the admin may not have it on hand', () => {
    const result = createAppointmentSchema.safeParse({
      requesterName: 'Dr. Rivera',
      scheduledAt: '2026-09-01T10:00:00Z',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid email with a field error', () => {
    const result = createAppointmentSchema.safeParse({
      requesterName: 'X',
      requesterEmail: 'not-an-email',
      scheduledAt: '2026-09-01T10:00:00Z',
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.flatten().fieldErrors.requesterEmail).toBeDefined();
  });

  it('requires scheduledAt', () => {
    const result = createAppointmentSchema.safeParse({ requesterName: 'X' });
    expect(result.success).toBe(false);
  });

  it('enforces max length on name', () => {
    const result = createAppointmentSchema.safeParse({
      requesterName: 'a'.repeat(121),
      scheduledAt: '2026-09-01T10:00:00Z',
    });
    expect(result.success).toBe(false);
  });

  it('coerces empty optional research group to undefined', () => {
    const result = createAppointmentSchema.safeParse({
      requesterName: 'Rivera',
      researchGroup: '',
      scheduledAt: '2026-09-01T10:00:00Z',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.researchGroup).toBeUndefined();
  });
});

describe('updateAppointmentSchema', () => {
  it('makes every field optional (partial edit)', () => {
    expect(updateAppointmentSchema.safeParse({}).success).toBe(true);
    expect(updateAppointmentSchema.safeParse({ topic: 'New topic' }).success).toBe(true);
  });
});

describe('cancelAppointmentSchema', () => {
  it('requires a non-empty reason', () => {
    expect(cancelAppointmentSchema.safeParse({ reason: '' }).success).toBe(false);
    expect(cancelAppointmentSchema.safeParse({ reason: 'Conflict' }).success).toBe(true);
  });
});

describe('listAppointmentsQuerySchema', () => {
  it('accepts an optional status filter and rejects bad values', () => {
    expect(listAppointmentsQuerySchema.safeParse({}).success).toBe(true);
    expect(listAppointmentsQuerySchema.safeParse({ status: 'scheduled' }).success).toBe(true);
    expect(listAppointmentsQuerySchema.safeParse({ status: 'nope' }).success).toBe(false);
  });
});
