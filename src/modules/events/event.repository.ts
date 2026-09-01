import { prisma } from '@/modules/shared/lib/prisma';
import type { Prisma, Event as PrismaEvent } from '@prisma/client';
import type { AuditContext, Event } from './event.types';
import type { CreateEventInput, UpdateEventInput } from './event.schema';

// The ONLY place Prisma is used for event data. No business rules here — the service decides
// WHAT to write; the repository just persists it atomically alongside its audit entry.

export interface EventRepository {
  findById(id: string): Promise<Event | null>;
  /** Newest first. Upcoming/past is split by the caller against the current clock. */
  list(): Promise<Event[]>;
  createWithAudit(input: { data: CreateEventInput; audit: AuditContext }): Promise<Event>;
  updateWithAudit(input: {
    id: string;
    data: UpdateEventInput;
    audit: AuditContext;
  }): Promise<Event>;
  deleteWithAudit(input: { id: string; audit: AuditContext }): Promise<void>;
}

function toDomain(row: PrismaEvent): Event {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    eventDate: row.eventDate,
    photoUrls: row.photoUrls,
    videoUrls: row.videoUrls,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function auditCreateInput(audit: AuditContext, entityId: string): Prisma.AuditLogCreateInput {
  return {
    actor: audit.actor,
    action: audit.action,
    entityType: 'event',
    entityId,
    metadata: (audit.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
  };
}

export class PrismaEventRepository implements EventRepository {
  async findById(id: string): Promise<Event | null> {
    const row = await prisma.event.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async list(): Promise<Event[]> {
    // One query for every event, ordered by date descending. The public tab needs both halves
    // (upcoming ascending, past descending) and the admin table needs all of them, so splitting
    // this into two date-filtered queries would put the "now" boundary in SQL — where it would be
    // baked into the prerendered page and go stale. The volume is tens of rows.
    const rows = await prisma.event.findMany({ orderBy: { eventDate: 'desc' } });
    return rows.map(toDomain);
  }

  async createWithAudit(input: { data: CreateEventInput; audit: AuditContext }): Promise<Event> {
    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.event.create({
        data: {
          title: input.data.title,
          description: input.data.description,
          eventDate: input.data.eventDate,
          photoUrls: input.data.photoUrls ?? [],
          videoUrls: input.data.videoUrls ?? [],
        },
      });
      await tx.auditLog.create({ data: auditCreateInput(input.audit, row.id) });
      return row;
    });
    return toDomain(created);
  }

  async updateWithAudit(input: {
    id: string;
    data: UpdateEventInput;
    audit: AuditContext;
  }): Promise<Event> {
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.event.update({
        where: { id: input.id },
        data: {
          ...(input.data.title !== undefined ? { title: input.data.title } : {}),
          ...(input.data.description !== undefined ? { description: input.data.description } : {}),
          ...(input.data.eventDate !== undefined ? { eventDate: input.data.eventDate } : {}),
          // A media array is replaced wholesale when present — `set` says so explicitly, so a PUT
          // carrying `photoUrls: []` clears the gallery rather than reading as "no change".
          ...(input.data.photoUrls !== undefined
            ? { photoUrls: { set: input.data.photoUrls } }
            : {}),
          ...(input.data.videoUrls !== undefined
            ? { videoUrls: { set: input.data.videoUrls } }
            : {}),
        },
      });
      await tx.auditLog.create({ data: auditCreateInput(input.audit, row.id) });
      return row;
    });
    return toDomain(updated);
  }

  async deleteWithAudit(input: { id: string; audit: AuditContext }): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.event.delete({ where: { id: input.id } });
      await tx.auditLog.create({ data: auditCreateInput(input.audit, input.id) });
    });
  }
}
