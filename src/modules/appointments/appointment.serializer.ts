import type { Appointment } from './appointment.types';

// Response DTOs. The `cancelToken` is a bearer secret (it authorizes self-cancel), so it must NOT
// leak in list/admin/transition responses — only the create response goes back to the originating
// visitor, who legitimately needs their cancel link.

/** Admin/list/transition view — cancelToken omitted. */
export type AppointmentView = Omit<Appointment, 'cancelToken'>;

/** Owner view returned once to the visitor who just created the appointment — includes the token. */
export type AppointmentOwnerView = Appointment;

export function toAppointmentView(appointment: Appointment): AppointmentView {
  // Destructure the secret out explicitly so future fields default to being exposed, but the token
  // never is unless a caller opts into the owner view.
  const { cancelToken: _cancelToken, ...view } = appointment;
  void _cancelToken;
  return view;
}

export function toAppointmentOwnerView(appointment: Appointment): AppointmentOwnerView {
  return appointment;
}
