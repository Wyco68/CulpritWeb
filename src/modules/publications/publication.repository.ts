import { prisma } from '@/modules/shared/lib/prisma';
import type { Prisma, Publication as PrismaPublication } from '@prisma/client';
import type { AuditContext, Publication } from './publication.types';
import type { CreatePublicationInput, UpdatePublicationInput } from './publication.schema';

// The ONLY place Prisma is used for publication data. No business rules here — the service
// decides WHAT to write; the repository just persists it atomically alongside its audit entry.

export type CreatePublicationData = CreatePublicationInput;
export type UpdatePublicationData = UpdatePublicationInput;

export interface PublicationRepository {
  findById(id: string): Promise<Publication | null>;
  /** Ordered by year desc, then createdAt desc (most recent first). */
  list(): Promise<Publication[]>;
  createWithAudit(input: {
    data: CreatePublicationData;
    audit: AuditContext;
  }): Promise<Publication>;
  updateWithAudit(input: {
    id: string;
    data: UpdatePublicationData;
    audit: AuditContext;
  }): Promise<Publication>;
  deleteWithAudit(input: { id: string; audit: AuditContext }): Promise<void>;
}

function toDomain(row: PrismaPublication): Publication {
  return {
    id: row.id,
    title: row.title,
    authors: row.authors,
    venue: row.venue,
    year: row.year,
    link: row.link,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function auditCreateInput(audit: AuditContext, entityId: string): Prisma.AuditLogCreateInput {
  return {
    actor: audit.actor,
    action: audit.action,
    entityType: 'publication',
    entityId,
    metadata: (audit.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
  };
}

export class PrismaPublicationRepository implements PublicationRepository {
  async findById(id: string): Promise<Publication | null> {
    const row = await prisma.publication.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async list(): Promise<Publication[]> {
    const rows = await prisma.publication.findMany({
      orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map(toDomain);
  }

  async createWithAudit(input: {
    data: CreatePublicationData;
    audit: AuditContext;
  }): Promise<Publication> {
    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.publication.create({
        data: {
          title: input.data.title,
          authors: input.data.authors,
          venue: input.data.venue,
          year: input.data.year,
          link: input.data.link ?? null,
        },
      });
      await tx.auditLog.create({ data: auditCreateInput(input.audit, row.id) });
      return row;
    });
    return toDomain(created);
  }

  async updateWithAudit(input: {
    id: string;
    data: UpdatePublicationData;
    audit: AuditContext;
  }): Promise<Publication> {
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.publication.update({
        where: { id: input.id },
        data: {
          ...(input.data.title !== undefined ? { title: input.data.title } : {}),
          ...(input.data.authors !== undefined ? { authors: input.data.authors } : {}),
          ...(input.data.venue !== undefined ? { venue: input.data.venue } : {}),
          ...(input.data.year !== undefined ? { year: input.data.year } : {}),
          ...(input.data.link !== undefined ? { link: input.data.link ?? null } : {}),
        },
      });
      await tx.auditLog.create({ data: auditCreateInput(input.audit, row.id) });
      return row;
    });
    return toDomain(updated);
  }

  async deleteWithAudit(input: { id: string; audit: AuditContext }): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.publication.delete({ where: { id: input.id } });
      await tx.auditLog.create({ data: auditCreateInput(input.audit, input.id) });
    });
  }
}
