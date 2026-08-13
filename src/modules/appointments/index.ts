// appointments module — no approve/decline/book review queue and no Calendly sync of any kind: an
// appointment exists ONLY because the admin declared it directly (Manage Appointments). The
// service is the SOLE authority on its transitions (`scheduled -> cancelled`, `scheduled ->
// scheduled` reschedule); illegal moves → 409. Hard delete is a separate, explicitly audited admin
// action, not a lifecycle transition. Cross-module code imports only from here.

export {
  createAppointmentSchema,
  updateAppointmentSchema,
  cancelAppointmentSchema,
  rescheduleAppointmentSchema,
  updateAppointmentVisibilitySchema,
  listAppointmentsQuerySchema,
  appointmentStatusSchema,
  type CreateAppointmentInput,
  type UpdateAppointmentInput,
  type CancelAppointmentInput,
  type RescheduleAppointmentInput,
  type UpdateAppointmentVisibilityInput,
  type ListAppointmentsQuery,
  type AppointmentStatus,
} from './appointment.schema';

export type { Appointment, AuditContext } from './appointment.types';

export {
  createAppointmentService,
  type AppointmentService,
  type AppointmentServiceDeps,
} from './appointment.service';

export type {
  AppointmentRepository,
  ListAppointmentsFilter,
} from './appointment.repository';

export {
  createUpcomingEventsService,
  type UpcomingEventsService,
  type UpcomingEventsServiceDeps,
  type UpcomingEventsResult,
} from './upcoming-events.service';

export { toAppointmentView, type AppointmentView } from './appointment.serializer';

export { getAppointmentService, getUpcomingEventsService } from './container';

export { UpcomingEventsList } from './ui/upcoming-events-list';
export { AppointmentsTable } from './ui/appointments-table';
export { AppointmentFormDialog } from './ui/appointment-form-dialog';
export { RescheduleDialog } from './ui/reschedule-dialog';
