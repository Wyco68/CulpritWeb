import type { AppointmentStatus } from './appointment.schema';

// Domain model — the shape services/routes work with. Mapped from the Prisma row inside the
// repository so Prisma's generated types never leak across the service boundary.
export type Appointment = {
  id: string;
  requesterName: string;
  /** Optional — informational only, never used to send email (see module comment in
   *  appointment.service.ts for why no notification exists here at all). */
  requesterEmail: string | null;
  researchGroup: string | null;
  scheduledAt: Date;
  topic: string | null;
  status: AppointmentStatus;
  cancelReason: string | null;
  /** Admin opt-in per row: whether this appointment appears on the public Upcoming Events tab. */
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/** Append-only audit context supplied by the service (business layer), persisted by the repo. */
export type AuditContext = {
  actor: string;
  action: string;
  metadata?: Record<string, unknown>;
};
