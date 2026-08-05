import { prisma } from '@/modules/shared/lib/prisma';
import type { Prisma, Appointment as PrismaAppointment } from '@prisma/client';
import type { Appointment, AuditContext } from './appointment.types';
import type { AppointmentSource, AppointmentStatus } from './appointment.schema';

// The ONLY place Prisma is used for appointment data. No business rules here — the service owns
// the state machine and decides WHAT to write; the repository just persists it atomically.

export type CreateAppointmentData = {
  requesterName: string;
  requesterEmail: string;
  researchGroup?: string | null;
  requestedTime?: Date | null;
  topic?: string | null;
  source: AppointmentSource;
  status: AppointmentStatus;
  calendlyEventRef?: string | null;
  cancelToken: string;
};

export type UpdateAppointmentData = {
  status: AppointmentStatus;
  calendlyEventRef?: string | null;
  cancelReason?: string | null;
};

export type ListAppointmentsFilter = {
  status?: AppointmentStatus;
  source?: AppointmentSource;
  /** Match any of these statuses (used by the upcoming-events read path: approved OR booked). */
  statusIn?: AppointmentStatus[];
  /** Only appointments whose requestedTime OR scheduledAt is at/after this instant. */
  fromTime?: Date;
};

export interface AppointmentRepository {
  findById(id: string): Promise<Appointment | null>;
  list(filter?: ListAppointmentsFilter): Promise<Appointment[]>;
  /** Create the appointment and its audit entry in one transaction. */
  createWithAudit(input: { data: CreateAppointmentData; audit: AuditContext }): Promise<Appointment>;
  /** Update appointment fields and write an audit entry in one transaction. No hard delete exists. */
  updateWithAudit(input: {
    id: string;
    data: UpdateAppointmentData;
    audit: AuditContext;
  }): Promise<Appointment>;
}

function toDomain(row: PrismaAppointment): Appointment {
  return {
    id: row.id,
    requesterName: row.requesterName,
    requesterEmail: row.requesterEmail,
    researchGroup: row.researchGroup,
    requestedTime: row.requestedTime,
    topic: row.topic,
    source: row.source as AppointmentSource,
    status: row.status as AppointmentStatus,
    calendlyEventRef: row.calendlyEventRef,
    cancelReason: row.cancelReason,
    cancelToken: row.cancelToken,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    scheduledAt: row.scheduledAt,
  };
}

function auditCreateInput(
  audit: AuditContext,
  entityId: string,
): Prisma.AuditLogCreateInput {
  return {
    actor: audit.actor,
    action: audit.action,
    entityType: 'appointment',
    entityId,
    metadata: (audit.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
  };
}

export class PrismaAppointmentRepository implements AppointmentRepository {
  async findById(id: string): Promise<Appointment | null> {
    const row = await prisma.appointment.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async list(filter?: ListAppointmentsFilter): Promise<Appointment[]> {
    const rows = await prisma.appointment.findMany({
      where: {
        ...(filter?.status ? { status: filter.status } : {}),
        ...(filter?.statusIn ? { status: { in: filter.statusIn } } : {}),
        ...(filter?.source ? { source: filter.source } : {}),
        ...(filter?.fromTime
          ? {
              OR: [
                { requestedTime: { gte: filter.fromTime } },
                { scheduledAt: { gte: filter.fromTime } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toDomain);
  }

  async createWithAudit(input: {
    data: CreateAppointmentData;
    audit: AuditContext;
  }): Promise<Appointment> {
    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.appointment.create({
        data: {
          requesterName: input.data.requesterName,
          requesterEmail: input.data.requesterEmail,
          researchGroup: input.data.researchGroup ?? null,
          requestedTime: input.data.requestedTime ?? null,
          topic: input.data.topic ?? null,
          source: input.data.source,
          status: input.data.status,
          calendlyEventRef: input.data.calendlyEventRef ?? null,
          cancelToken: input.data.cancelToken,
        },
      });
      await tx.auditLog.create({ data: auditCreateInput(input.audit, row.id) });
      return row;
    });
    return toDomain(created);
  }

  async updateWithAudit(input: {
    id: string;
    data: UpdateAppointmentData;
    audit: AuditContext;
  }): Promise<Appointment> {
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.appointment.update({
        where: { id: input.id },
        data: {
          status: input.data.status,
          ...(input.data.calendlyEventRef !== undefined
            ? { calendlyEventRef: input.data.calendlyEventRef }
            : {}),
          ...(input.data.cancelReason !== undefined
            ? { cancelReason: input.data.cancelReason }
            : {}),
        },
      });
      await tx.auditLog.create({ data: auditCreateInput(input.audit, row.id) });
      return row;
    });
    return toDomain(updated);
  }
}
