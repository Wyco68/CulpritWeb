import { z } from 'zod';
import { stripHtml } from '@/modules/shared/lib/sanitize';
import { parseInstitutionLocalDatetime } from '@/modules/shared/lib/timezone';

// A bare `<input type="datetime-local">` value ("YYYY-MM-DDTHH:mm") carries no timezone, so a
// plain `z.coerce.date()` would interpret it using whatever machine happens to run the parse
// (browser on the client, container on the server) — see `parseInstitutionLocalDatetime`. Zod's
// own `z.coerce.date()` piped through `z.preprocess` here so both the local admin string and the
// UTC ISO string it round-trips to on the wire (already zone-explicit) parse identically.
const institutionDate = z.preprocess(
  (value) => (typeof value === 'string' ? parseInstitutionLocalDatetime(value) : value),
  z.date(),
);

// Single source of truth for appointment I/O. The frontend infers its form types from these
// schemas; the server re-parses at the boundary (client validation is UX only).
//
// There is no approve/decline/book review queue and no Calendly sync: an appointment exists ONLY
// because the admin declared it directly. See appointment.service.ts.

const safeText = (max: number) => z.string().trim().min(1).max(max).transform(stripHtml);
const optionalSafeText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => stripHtml(v) || undefined)
    .optional();
const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .max(200)
  .refine((v) => v === '' || z.string().email().safeParse(v).success, {
    message: 'Must be a valid email address.',
  })
  .transform((v) => v || undefined)
  .optional();

// Domain enum owned here (not imported from Prisma) so nothing leaks across the service boundary.
export const appointmentStatusSchema = z.enum(['scheduled', 'cancelled']);
export type AppointmentStatus = z.infer<typeof appointmentStatusSchema>;

/** Admin: declare an appointment directly — the only way one is ever created. */
export const createAppointmentSchema = z.object({
  requesterName: safeText(120),
  requesterEmail: optionalEmail,
  researchGroup: optionalSafeText(160),
  scheduledAt: institutionDate,
  topic: optionalSafeText(2000),
});
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;

/** Admin: edit a scheduled appointment's details (not its status, and not `scheduledAt` — cancel
 *  is a separate action and changing the time is `reschedule`'s job alone, so there is exactly one
 *  place in the UI that can move a meeting). */
export const updateAppointmentSchema = createAppointmentSchema.omit({ scheduledAt: true }).partial();
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;

/** Admin: cancel a scheduled appointment; a reason is required for the audit trail. */
export const cancelAppointmentSchema = z.object({
  reason: safeText(1000),
});
export type CancelAppointmentInput = z.infer<typeof cancelAppointmentSchema>;

/** Admin: reschedule a scheduled appointment — changes `scheduledAt` only, nothing else. */
export const rescheduleAppointmentSchema = z.object({
  scheduledAt: institutionDate,
});
export type RescheduleAppointmentInput = z.infer<typeof rescheduleAppointmentSchema>;

/** Admin: toggle whether an appointment appears on the public Upcoming Events tab. */
export const updateAppointmentVisibilitySchema = z.object({
  isPublic: z.boolean(),
});
export type UpdateAppointmentVisibilityInput = z.infer<typeof updateAppointmentVisibilitySchema>;

/** Admin: list filter (query string). */
export const listAppointmentsQuerySchema = z.object({
  status: appointmentStatusSchema.optional(),
});
export type ListAppointmentsQuery = z.infer<typeof listAppointmentsQuerySchema>;
