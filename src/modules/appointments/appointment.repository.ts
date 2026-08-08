import { prisma } from '@/modules/shared/lib/prisma';
import type { Prisma, Appointment as PrismaAppointment } from '@prisma/client';
import type { Appointment, AuditContext } from './appointment.types';
import type { AppointmentStatus } from './appointment.schema';

// The ONLY place Prisma is used for appointment data. No business rules here — the service owns
// the state machine and decides WHAT to write; the repository just persists it atomically.

export type CreateAppointmentData = {
  requesterName: string;
  requesterEmail?: string | null;
  researchGroup?: string | null;
  scheduledAt: Date;
  topic?: string | null;
};

export type UpdateAppointmentData = {
  requesterName?: string;
  requesterEmail?: string | null;
  researchGroup?: string | null;
  scheduledAt?: Date;
  topic?: string | null;
  status?: AppointmentStatus;
  cancelReason?: string | null;
};

export type ListAppointmentsFilter = {
  status?: AppointmentStatus;
  statusIn?: AppointmentStatus[];
  /** Only appointments scheduled at/after this instant. */
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
    scheduledAt: row.scheduledAt,
    topic: row.topic,
    status: row.status as AppointmentStatus,
    cancelReason: row.cancelReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function auditCreateInput(audit: AuditContext, entityId: string): Prisma.AuditLogCreateInput {
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
        ...(filter?.fromTime ? { scheduledAt: { gte: filter.fromTime } } : {}),
      },
      orderBy: { scheduledAt: 'asc' },
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
          requesterEmail: input.data.requesterEmail ?? null,
          researchGroup: input.data.researchGroup ?? null,
          scheduledAt: input.data.scheduledAt,
          topic: input.data.topic ?? null,
          status: 'scheduled',
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
          ...(input.data.requesterName !== undefined ? { requesterName: input.data.requesterName } : {}),
          ...(input.data.requesterEmail !== undefined ? { requesterEmail: input.data.requesterEmail } : {}),
          ...(input.data.researchGroup !== undefined ? { researchGroup: input.data.researchGroup } : {}),
          ...(input.data.scheduledAt !== undefined ? { scheduledAt: input.data.scheduledAt } : {}),
          ...(input.data.topic !== undefined ? { topic: input.data.topic } : {}),
          ...(input.data.status !== undefined ? { status: input.data.status } : {}),
          ...(input.data.cancelReason !== undefined ? { cancelReason: input.data.cancelReason } : {}),
        },
      });
      await tx.auditLog.create({ data: auditCreateInput(input.audit, row.id) });
      return row;
    });
    return toDomain(updated);
  }
}
