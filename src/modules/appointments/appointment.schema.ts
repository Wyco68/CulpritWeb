import { z } from 'zod';
import { stripHtml } from '@/modules/shared/lib/sanitize';

// Single source of truth for appointment I/O. The frontend infers its form types from these
// schemas; the server re-parses at the boundary (client validation is UX only).
//
// Field names are camelCase to match the Prisma model and avoid a mapping layer. Free-text
// fields are sanitized (HTML stripped) via `.transform` AFTER shape validation.

const safeText = (max: number) => z.string().trim().min(1).max(max).transform(stripHtml);
// Optional free text: sanitize, and treat blank/whitespace as absent. `.optional()` stays outermost
// so the object key is genuinely optional (`field?: string`), not required-with-undefined.
const optionalSafeText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => stripHtml(v) || undefined)
    .optional();

// Domain enums owned here (not imported from Prisma) so nothing leaks across the service boundary.
export const appointmentStatusSchema = z.enum([
  'pending',
  'approved',
  'declined',
  'booked',
  'cancelled',
]);
export const appointmentSourceSchema = z.enum(['direct', 'request']);

export type AppointmentStatus = z.infer<typeof appointmentStatusSchema>;
export type AppointmentSource = z.infer<typeof appointmentSourceSchema>;

/** Public: create a free-form meeting request → pending. */
export const createAppointmentRequestSchema = z.object({
  requesterName: safeText(120),
  requesterEmail: z.string().trim().toLowerCase().email().max(200),
  researchGroup: optionalSafeText(160),
  requestedTime: z.coerce.date().optional(),
  topic: optionalSafeText(2000),
  turnstileToken: z.string().min(1).max(4096),
});
export type CreateAppointmentRequestInput = z.infer<typeof createAppointmentRequestSchema>;

/** Public: record a direct Calendly booking → booked (source=direct). */
export const createDirectBookingSchema = z.object({
  requesterName: safeText(120),
  requesterEmail: z.string().trim().toLowerCase().email().max(200),
  researchGroup: optionalSafeText(160),
  calendlyEventRef: safeText(300),
  requestedTime: z.coerce.date(),
  turnstileToken: z.string().min(1).max(4096),
});
export type CreateDirectBookingInput = z.infer<typeof createDirectBookingSchema>;

/** Public (token): visitor self-cancels their own appointment. `id` comes from the route path. */
export const cancelByTokenSchema = z.object({
  cancelToken: z.string().trim().min(1).max(200),
  reason: optionalSafeText(1000),
});
export type CancelByTokenInput = z.infer<typeof cancelByTokenSchema>;

/** Admin: mark an approved request booked; the Calendly event reference is required. */
export const adminBookSchema = z.object({
  calendlyEventRef: safeText(300),
});
export type AdminBookInput = z.infer<typeof adminBookSchema>;

/** Admin: cancel an approved/booked appointment; a reason is required for the audit trail. */
export const adminCancelSchema = z.object({
  reason: safeText(1000),
});
export type AdminCancelInput = z.infer<typeof adminCancelSchema>;

/** Admin: decline a pending request; reason optional. */
export const adminDeclineSchema = z.object({
  reason: optionalSafeText(1000),
});
export type AdminDeclineInput = z.infer<typeof adminDeclineSchema>;

/** Admin: list filter (query string). */
export const listAppointmentsQuerySchema = z.object({
  status: appointmentStatusSchema.optional(),
  source: appointmentSourceSchema.optional(),
});
export type ListAppointmentsQuery = z.infer<typeof listAppointmentsQuerySchema>;
