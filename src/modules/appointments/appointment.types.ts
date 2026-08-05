import type { AppointmentSource, AppointmentStatus } from './appointment.schema';

// Domain model — the shape services/routes work with. Mapped from the Prisma row inside the
// repository so Prisma's generated types never leak across the service boundary.
export type Appointment = {
  id: string;
  requesterName: string;
  requesterEmail: string;
  researchGroup: string | null;
  requestedTime: Date | null;
  topic: string | null;
  source: AppointmentSource;
  status: AppointmentStatus;
  calendlyEventRef: string | null;
  cancelReason: string | null;
  cancelToken: string;
  createdAt: Date;
  updatedAt: Date;
  /** Calendly-reported scheduled start time, when linked via the REST integration/webhook.
   *  Optional on the domain type so existing call sites/fixtures built before this field existed
   *  keep compiling; only the upcoming-events read path relies on it. */
  scheduledAt?: Date | null;
};

/** Admin-driven transition verbs; visitor self-cancel reuses `cancel`. */
export type AppointmentAction = 'approve' | 'decline' | 'book' | 'cancel';

/** Which templated email a transition should send. */
export type AppointmentEmailKind =
  | 'received_request'
  | 'received_direct'
  | 'approved'
  | 'declined'
  | 'booked'
  | 'cancelled';

/** Append-only audit context supplied by the service (business layer), persisted by the repo. */
export type AuditContext = {
  actor: string;
  action: string;
  metadata?: Record<string, unknown>;
};

/**
 * Outbound notification port owned by the appointments domain (ports & adapters). The
 * notifications module provides the concrete adapter. Implementations must NEVER throw — a failed
 * email must not roll back a committed transition; the AuditLog is the durable record.
 */
export interface AppointmentNotifier {
  sendAppointmentEmail(kind: AppointmentEmailKind, appointment: Appointment): Promise<void>;
}
