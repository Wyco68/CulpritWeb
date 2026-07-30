import { randomBytes } from 'node:crypto';
import { prisma } from '@/modules/shared/lib/prisma';
import type { Prisma } from '@prisma/client';
import type { AppointmentStatus } from './appointment.schema';

// The ONLY place Prisma is touched for Calendly-sourced appointment associations. No business
// rules here: lookup by the unique invitee uri, create a Calendly-originated booking (a legal
// CREATE transition), and stamp cancelledAt. Status TRANSITIONS still flow through the service.

export type CalendlyBookingRow = {
  inviteeUri: string;
  eventUri: string;
  eventTypeUri: string | null;
  requesterName: string;
  requesterEmail: string;
  scheduledAt: Date;
  meetingUrl: string | null;
};

export type AppointmentRef = { id: string; status: AppointmentStatus };

export interface CalendlyLinkRepository {
  findByInviteeUri(inviteeUri: string): Promise<AppointmentRef | null>;
  /** Lookup by the scheduled-event uri (used to reconcile an admin-initiated Calendly cancel). */
  findByEventUri(eventUri: string): Promise<AppointmentRef | null>;
  /** Create a booked, direct-source appointment from a Calendly booking, with an audit entry. */
  createFromCalendly(data: CalendlyBookingRow): Promise<AppointmentRef>;
  stampCancelledAt(id: string, cancelledAt: Date): Promise<void>;
}

export class PrismaCalendlyLinkRepository implements CalendlyLinkRepository {
  async findByInviteeUri(inviteeUri: string): Promise<AppointmentRef | null> {
    const row = await prisma.appointment.findUnique({
      where: { calendlyInviteeUri: inviteeUri },
      select: { id: true, status: true },
    });
    return row ? { id: row.id, status: row.status as AppointmentStatus } : null;
  }

  async findByEventUri(eventUri: string): Promise<AppointmentRef | null> {
    const row = await prisma.appointment.findFirst({
      where: { calendlyEventUri: eventUri },
      select: { id: true, status: true },
    });
    return row ? { id: row.id, status: row.status as AppointmentStatus } : null;
  }

  async createFromCalendly(data: CalendlyBookingRow): Promise<AppointmentRef> {
    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.appointment.create({
        data: {
          requesterName: data.requesterName || 'Calendly invitee',
          requesterEmail: data.requesterEmail,
          source: 'direct',
          status: 'booked',
          calendlyEventRef: data.eventUri,
          calendlyEventUri: data.eventUri,
          calendlyInviteeUri: data.inviteeUri,
          calendlyEventTypeUri: data.eventTypeUri,
          meetingUrl: data.meetingUrl,
          scheduledAt: data.scheduledAt,
          requestedTime: data.scheduledAt,
          cancelToken: randomBytes(32).toString('hex'),
        },
        select: { id: true, status: true },
      });
      const audit: Prisma.AuditLogCreateInput = {
        actor: 'calendly:webhook',
        action: 'appointment.booked.calendly',
        entityType: 'appointment',
        entityId: row.id,
        metadata: { inviteeUri: data.inviteeUri, eventUri: data.eventUri },
      };
      await tx.auditLog.create({ data: audit });
      return row;
    });
    return { id: created.id, status: created.status as AppointmentStatus };
  }

  async stampCancelledAt(id: string, cancelledAt: Date): Promise<void> {
    // Non-status metadata stamp; the cancelled TRANSITION itself is applied by the service.
    await prisma.appointment.update({ where: { id }, data: { cancelledAt } });
  }
}
