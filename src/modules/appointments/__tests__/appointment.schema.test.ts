import { describe, expect, it } from 'vitest';
import {
  adminBookSchema,
  adminCancelSchema,
  cancelByTokenSchema,
  createAppointmentRequestSchema,
  createDirectBookingSchema,
  listAppointmentsQuerySchema,
} from '../appointment.schema';

describe('createAppointmentRequestSchema', () => {
  it('parses a valid request and lowercases the email', () => {
    const result = createAppointmentRequestSchema.safeParse({
      requesterName: 'Dr. Rivera',
      requesterEmail: 'Rivera@Example.COM',
      researchGroup: 'Systems Security',
      requestedTime: '2026-09-01T10:00:00Z',
      topic: 'Intro call',
      turnstileToken: 'tok',
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.requesterEmail).toBe('rivera@example.com');
    expect(result.data.requestedTime).toBeInstanceOf(Date);
  });

  it('strips HTML from free-text fields (sanitization)', () => {
    const result = createAppointmentRequestSchema.safeParse({
      requesterName: 'Dr. <b>Rivera</b>',
      requesterEmail: 'rivera@example.com',
      topic: '<script>alert(1)</script>Malware',
      turnstileToken: 'tok',
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.requesterName).toBe('Dr. Rivera');
    expect(result.data.topic).toBe('alert(1)Malware');
  });

  it('rejects an invalid email with a field error', () => {
    const result = createAppointmentRequestSchema.safeParse({
      requesterName: 'X',
      requesterEmail: 'not-an-email',
      turnstileToken: 'tok',
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.flatten().fieldErrors.requesterEmail).toBeDefined();
  });

  it('requires the turnstile token', () => {
    const result = createAppointmentRequestSchema.safeParse({
      requesterName: 'X',
      requesterEmail: 'rivera@example.com',
    });
    expect(result.success).toBe(false);
  });

  it('enforces max length on name', () => {
    const result = createAppointmentRequestSchema.safeParse({
      requesterName: 'a'.repeat(121),
      requesterEmail: 'rivera@example.com',
      turnstileToken: 'tok',
    });
    expect(result.success).toBe(false);
  });

  it('coerces empty optional research group to undefined', () => {
    const result = createAppointmentRequestSchema.safeParse({
      requesterName: 'Rivera',
      requesterEmail: 'rivera@example.com',
      researchGroup: '',
      turnstileToken: 'tok',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.researchGroup).toBeUndefined();
  });
});

describe('createDirectBookingSchema', () => {
  it('requires calendlyEventRef and requestedTime', () => {
    const missing = createDirectBookingSchema.safeParse({
      requesterName: 'Rivera',
      requesterEmail: 'rivera@example.com',
      turnstileToken: 'tok',
    });
    expect(missing.success).toBe(false);

    const ok = createDirectBookingSchema.safeParse({
      requesterName: 'Rivera',
      requesterEmail: 'rivera@example.com',
      calendlyEventRef: 'evt_1',
      requestedTime: '2026-09-01T10:00:00Z',
      turnstileToken: 'tok',
    });
    expect(ok.success).toBe(true);
  });
});

describe('admin + token schemas', () => {
  it('adminBookSchema requires a calendly ref', () => {
    expect(adminBookSchema.safeParse({}).success).toBe(false);
    expect(adminBookSchema.safeParse({ calendlyEventRef: 'evt_1' }).success).toBe(true);
  });

  it('adminCancelSchema requires a non-empty reason', () => {
    expect(adminCancelSchema.safeParse({ reason: '' }).success).toBe(false);
    expect(adminCancelSchema.safeParse({ reason: 'Conflict' }).success).toBe(true);
  });

  it('cancelByTokenSchema requires the token', () => {
    expect(cancelByTokenSchema.safeParse({}).success).toBe(false);
    expect(cancelByTokenSchema.safeParse({ cancelToken: 't' }).success).toBe(true);
  });

  it('listAppointmentsQuerySchema accepts an optional status filter and rejects bad values', () => {
    expect(listAppointmentsQuerySchema.safeParse({}).success).toBe(true);
    expect(listAppointmentsQuerySchema.safeParse({ status: 'booked' }).success).toBe(true);
    expect(listAppointmentsQuerySchema.safeParse({ status: 'nope' }).success).toBe(false);
  });
});
