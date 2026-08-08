import type { Appointment } from './appointment.types';

// Response DTO. Identity mapping today — kept as a named serializer (rather than passing
// `Appointment` straight through) so every route handler and UI consumer keeps calling
// `toAppointmentView(result)`, matching the response-shaping convention every other module in
// this app follows, and giving a single seam if a field ever needs hiding again.
export type AppointmentView = Appointment;

export function toAppointmentView(appointment: Appointment): AppointmentView {
  return appointment;
}
