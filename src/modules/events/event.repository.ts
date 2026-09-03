import { prisma } from '@/modules/shared/lib/prisma';
import type {
  Prisma,
  Event as PrismaEvent,
  EventParticipant as PrismaEventParticipant,
} from '@prisma/client';
import type { AuditContext, Event, EventParticipant, EventStats } from './event.types';
import type { CreateEventInput, UpdateEventInput } from './event.schema';

// The ONLY place Prisma is used for event data. No business rules here — the service decides
// WHAT to write; the repository just persists it atomically alongside its audit entry.

export interface EventRepository {
  findById(id: string): Promise<Event | null>;
  /** Newest first. Upcoming/past is split by the caller against the current clock. */
  list(): Promise<Event[]>;
  /**
   * Counts only, against the `now` the caller supplies. The boundary is a parameter rather than
   * `now()` in SQL so it stays the caller's clock — the same one `splitByTiming` uses — and so it
   * is injectable in tests.
   */
  stats(now: Date): Promise<EventStats>;
  createWithAudit(input: { data: CreateEventInput; audit: AuditContext }): Promise<Event>;
  updateWithAudit(input: {
    id: string;
    data: UpdateEventInput;
    audit: AuditContext;
  }): Promise<Event>;
  deleteWithAudit(input: { id: string; audit: AuditContext }): Promise<void>;

  /**
   * Insert participant rows for one event, skipping anyone whose team member is already on it.
   * Returns the rows actually written, so the service can report "added 3 of 5".
   *
   * Takes an array rather than a single row because adding a whole research group is the same
   * operation with more rows — one transaction, one audit entry, all-or-nothing.
   */
  addParticipantsWithAudit(input: {
    eventId: string;
    participants: NewParticipant[];
    audit: AuditContext;
  }): Promise<EventParticipant[]>;

  removeParticipantWithAudit(input: {
    eventId: string;
    participantId: string;
    audit: AuditContext;
  }): Promise<EventParticipant>;
}

/** A participant row before it exists — the snapshot the service resolved. */
export type NewParticipant = {
  teamMemberId: string | null;
  name: string;
  role: string | null;
  photoUrl: string | null;
};

/** Prisma's ordering for a participant list, shared by every read so the order is never a surprise. */
const PARTICIPANT_ORDER = [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }];

function toParticipant(row: PrismaEventParticipant): EventParticipant {
  return {
    id: row.id,
    eventId: row.eventId,
    teamMemberId: row.teamMemberId,
    name: row.name,
    role: row.role,
    photoUrl: row.photoUrl,
    sortOrder: row.sortOrder,
  };
}

function toDomain(row: PrismaEvent & { participants?: PrismaEventParticipant[] }): Event {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    eventDate: row.eventDate,
    photoUrls: row.photoUrls,
    videoUrls: row.videoUrls,
    participants: (row.participants ?? []).map(toParticipant),
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
    const row = await prisma.event.findUnique({
      where: { id },
      include: { participants: { orderBy: PARTICIPANT_ORDER } },
    });
    return row ? toDomain(row) : null;
  }

  async list(): Promise<Event[]> {
    // One query for every event, ordered by date descending. The public tab needs both halves
    // (upcoming ascending, past descending) and the admin table needs all of them, so splitting
    // this into two date-filtered queries would put the "now" boundary in SQL — where it would be
    // baked into the prerendered page and go stale. The volume is tens of rows.
    const rows = await prisma.event.findMany({
      orderBy: { eventDate: 'desc' },
      include: { participants: { orderBy: PARTICIPANT_ORDER } },
    });
    return rows.map(toDomain);
  }

  async stats(now: Date): Promise<EventStats> {
    // `gte`, not `gt`: an event starting exactly now is upcoming, matching splitByTiming.
    const upcomingWhere = { eventDate: { gte: now } };
    // Batched into one round trip; all three ride the eventDate index.
    const [total, upcoming, next] = await prisma.$transaction([
      prisma.event.count(),
      prisma.event.count({ where: upcomingWhere }),
      prisma.event.findFirst({
        where: upcomingWhere,
        orderBy: { eventDate: 'asc' },
        select: { eventDate: true },
      }),
    ]);
    return { total, upcoming, nextEventDate: next?.eventDate ?? null };
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
        include: { participants: { orderBy: PARTICIPANT_ORDER } },
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

  async addParticipantsWithAudit(input: {
    eventId: string;
    participants: NewParticipant[];
    audit: AuditContext;
  }): Promise<EventParticipant[]> {
    // Three queries regardless of how many people are being added — adding a 40-person group costs
    // the same round trips as adding one. It previously ran an INSERT per participant inside the
    // transaction (N + 3 queries), which is what made adding a group slow.
    //
    // Duplicates are left to the unique index on (event_id, team_member_id) via `skipDuplicates`
    // rather than being filtered by a preceding SELECT. That removes a query AND closes the race
    // the SELECT left open: two concurrent adds could both read "not present" and then both try to
    // insert. Postgres treats NULLs as distinct, so guest rows are never considered duplicates.
    return prisma.$transaction(async (tx) => {
      const highest = await tx.eventParticipant.aggregate({
        where: { eventId: input.eventId },
        _max: { sortOrder: true },
      });
      const base = (highest._max.sortOrder ?? -1) + 1;

      // `createManyAndReturn` gives back the rows that were actually written, which is what lets
      // the service report "added 2, skipped 1" — plain `createMany` returns only a count.
      const written = await tx.eventParticipant.createManyAndReturn({
        data: input.participants.map((participant, index) => ({
          eventId: input.eventId,
          teamMemberId: participant.teamMemberId,
          name: participant.name,
          role: participant.role,
          photoUrl: participant.photoUrl,
          sortOrder: base + index,
        })),
        skipDuplicates: true,
      });

      if (written.length > 0) {
        await tx.auditLog.create({
          data: auditCreateInput(
            { ...input.audit, metadata: { ...input.audit.metadata, added: written.length } },
            input.eventId,
          ),
        });
      }
      return written.map(toParticipant);
    });
  }

  async removeParticipantWithAudit(input: {
    eventId: string;
    participantId: string;
    audit: AuditContext;
  }): Promise<EventParticipant> {
    return prisma.$transaction(async (tx) => {
      // Scoped by eventId as well as id, so a participant id from one event can never be used to
      // delete a row belonging to another.
      const row = await tx.eventParticipant.delete({
        where: { id: input.participantId, eventId: input.eventId },
      });
      // The full before-state goes into the audit entry, in the same transaction as the delete —
      // the project's standing rule for a destructive admin action.
      await tx.auditLog.create({
        data: auditCreateInput(
          { ...input.audit, metadata: { ...input.audit.metadata, removed: toParticipant(row) } },
          input.eventId,
        ),
      });
      return toParticipant(row);
    });
  }
}
