import { z } from 'zod';

// Boundary validation for the Calendly REST endpoints. Query/body only — the service maps to and
// from raw Calendly payloads. All free text is bounded; uris are validated as Calendly API URLs.

const calendlyUri = z
  .string()
  .trim()
  .url()
  .max(500)
  .refine((v) => v.startsWith('https://api.calendly.com/'), 'Must be a Calendly API URI.');

export const listScheduledEventsQuerySchema = z.object({
  status: z.enum(['active', 'canceled']).optional(),
  minStartTime: z.string().datetime().optional(),
  maxStartTime: z.string().datetime().optional(),
  count: z.coerce.number().int().min(1).max(100).optional(),
});
export type ListScheduledEventsQuery = z.infer<typeof listScheduledEventsQuerySchema>;

export const availabilityQuerySchema = z.object({
  eventTypeUri: calendlyUri,
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
});
export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;

export const cancelEventSchema = z.object({
  eventUri: calendlyUri,
  reason: z.string().trim().max(1000).optional(),
});
export type CancelEventInput = z.infer<typeof cancelEventSchema>;
