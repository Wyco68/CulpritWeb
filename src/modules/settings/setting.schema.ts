import { z } from 'zod';

// Single source of truth for settings I/O.
export const updateSettingsSchema = z.object({
  upcomingEventsVisible: z.boolean(),
});
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
