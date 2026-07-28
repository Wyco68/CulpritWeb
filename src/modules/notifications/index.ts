// notifications module — React Email templates + Resend transport; one email per appointment
// transition (Received request / Received direct / Approved / Declined / Booked / Cancelled).
// Implements the appointments' AppointmentNotifier port. Email failure never rolls back state.
//
// Copy is English (default locale). Localizing via next-intl for email is a tracked follow-up —
// the template accepts pre-resolved strings, so it is an additive change.

export { createAppointmentNotifier } from './appointment-notifier';
export { AppointmentEmail, type AppointmentEmailProps } from './templates/appointment-email';
