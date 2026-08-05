import { z } from 'zod';

// Single source of truth for settings I/O. Both keys are optional so a PUT can update either or
// both in one call; at least one must be present.
export const updateSettingsSchema = z
  .object({
    upcomingEventsVisible: z.boolean().optional(),
    appointmentDurationMinutes: z.coerce.number().int().min(5).max(480).optional(),
  })
  .refine((v) => v.upcomingEventsVisible !== undefined || v.appointmentDurationMinutes !== undefined, {
    message: 'At least one setting must be provided.',
  });
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
