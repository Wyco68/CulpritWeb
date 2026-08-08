import { describe, expect, it } from 'vitest';
import { updateSettingsSchema } from '../setting.schema';

describe('updateSettingsSchema', () => {
  it('accepts upcomingEventsVisible', () => {
    const result = updateSettingsSchema.safeParse({ upcomingEventsVisible: true });
    expect(result.success).toBe(true);
  });

  it('rejects a missing visibility flag', () => {
    const result = updateSettingsSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects a non-boolean visibility flag', () => {
    const result = updateSettingsSchema.safeParse({ upcomingEventsVisible: 'yes' });
    expect(result.success).toBe(false);
  });
});
