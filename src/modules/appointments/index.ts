// appointments module — request intake, the status machine (service is the SOLE authority on
// transitions; illegal → 409), Calendly metadata, audit trail. Records are never hard-deleted.
// Cross-module code imports only from this surface.

export {
  createAppointmentRequestSchema,
  createDirectBookingSchema,
  cancelByTokenSchema,
  adminBookSchema,
  adminCancelSchema,
  adminDeclineSchema,
  listAppointmentsQuerySchema,
  appointmentStatusSchema,
  appointmentSourceSchema,
  type CreateAppointmentRequestInput,
  type CreateDirectBookingInput,
  type CancelByTokenInput,
  type AdminBookInput,
  type AdminCancelInput,
  type AdminDeclineInput,
  type ListAppointmentsQuery,
  type AppointmentStatus,
  type AppointmentSource,
} from './appointment.schema';

export type {
  Appointment,
  AppointmentAction,
  AppointmentEmailKind,
  AppointmentNotifier,
  AuditContext,
} from './appointment.types';

export {
  createAppointmentService,
  TRANSITIONS,
  type AppointmentService,
  type AppointmentServiceDeps,
} from './appointment.service';

export type {
  AppointmentRepository,
  ListAppointmentsFilter,
} from './appointment.repository';

export {
  toAppointmentView,
  toAppointmentOwnerView,
  type AppointmentView,
  type AppointmentOwnerView,
} from './appointment.serializer';

export { getAppointmentService, getCalendlyLinkStore } from './container';
