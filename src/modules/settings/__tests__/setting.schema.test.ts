import { describe, expect, it } from 'vitest';
import { updateSettingsSchema } from '../setting.schema';

describe('updateSettingsSchema', () => {
  it('accepts upcomingEventsVisible alone', () => {
    const result = updateSettingsSchema.safeParse({ upcomingEventsVisible: true });
    expect(result.success).toBe(true);
  });

  it('accepts appointmentDurationMinutes alone', () => {
    const result = updateSettingsSchema.safeParse({ appointmentDurationMinutes: 45 });
    expect(result.success).toBe(true);
  });

  it('accepts both together', () => {
    const result = updateSettingsSchema.safeParse({
      upcomingEventsVisible: false,
      appointmentDurationMinutes: 30,
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty object (at least one setting required)', () => {
    const result = updateSettingsSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects an out-of-range duration', () => {
    const result = updateSettingsSchema.safeParse({ appointmentDurationMinutes: 3 });
    expect(result.success).toBe(false);
  });

  it('rejects a non-boolean visibility flag', () => {
    const result = updateSettingsSchema.safeParse({ upcomingEventsVisible: 'yes' });
    expect(result.success).toBe(false);
  });
});
