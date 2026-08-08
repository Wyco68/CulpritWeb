import { prisma } from '@/modules/shared/lib/prisma';
import type { Prisma, Research as PrismaResearch } from '@prisma/client';
import type { AuditContext, Research } from './research.types';
import type { CreateResearchInput, UpdateResearchInput } from './research.schema';

// The ONLY place Prisma is used for research data. No business rules here — the service decides
// WHAT to write; the repository just persists it atomically alongside its audit entry.

export type CreateResearchData = CreateResearchInput;
export type UpdateResearchData = UpdateResearchInput;

export interface ResearchRepository {
  findById(id: string): Promise<Research | null>;
  list(): Promise<Research[]>;
  createWithAudit(input: { data: CreateResearchData; audit: AuditContext }): Promise<Research>;
  updateWithAudit(input: {
    id: string;
    data: UpdateResearchData;
    audit: AuditContext;
  }): Promise<Research>;
  deleteWithAudit(input: { id: string; audit: AuditContext }): Promise<void>;
}

function toDomain(row: PrismaResearch): Research {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    area: row.area,
    link: row.link,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function auditCreateInput(audit: AuditContext, entityId: string): Prisma.AuditLogCreateInput {
  return {
    actor: audit.actor,
    action: audit.action,
    entityType: 'research',
    entityId,
    metadata: (audit.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
  };
}

export class PrismaResearchRepository implements ResearchRepository {
  async findById(id: string): Promise<Research | null> {
    const row = await prisma.research.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async list(): Promise<Research[]> {
    const rows = await prisma.research.findMany({ orderBy: { sortOrder: 'asc' } });
    return rows.map(toDomain);
  }

  async createWithAudit(input: {
    data: CreateResearchData;
    audit: AuditContext;
  }): Promise<Research> {
    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.research.create({
        data: {
          title: input.data.title,
          summary: input.data.summary,
          area: input.data.area,
          link: input.data.link ?? null,
          sortOrder: input.data.sortOrder ?? 0,
        },
      });
      await tx.auditLog.create({ data: auditCreateInput(input.audit, row.id) });
      return row;
    });
    return toDomain(created);
  }

  async updateWithAudit(input: {
    id: string;
    data: UpdateResearchData;
    audit: AuditContext;
  }): Promise<Research> {
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.research.update({
        where: { id: input.id },
        data: {
          ...(input.data.title !== undefined ? { title: input.data.title } : {}),
          ...(input.data.summary !== undefined ? { summary: input.data.summary } : {}),
          ...(input.data.area !== undefined ? { area: input.data.area } : {}),
          ...(input.data.link !== undefined ? { link: input.data.link ?? null } : {}),
          ...(input.data.sortOrder !== undefined ? { sortOrder: input.data.sortOrder } : {}),
        },
      });
      await tx.auditLog.create({ data: auditCreateInput(input.audit, row.id) });
      return row;
    });
    return toDomain(updated);
  }

  async deleteWithAudit(input: { id: string; audit: AuditContext }): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.research.delete({ where: { id: input.id } });
      await tx.auditLog.create({ data: auditCreateInput(input.audit, input.id) });
    });
  }
}
