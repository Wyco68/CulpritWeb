import { prisma } from '@/modules/shared/lib/prisma';
import { auditLogData } from '@/modules/shared/lib/audit';
import type { Research as PrismaResearch } from '@prisma/client';
import type { AuditContext, Research, ResearchStats } from './research.types';
import type { CreateResearchInput, UpdateResearchInput } from './research.schema';

// The ONLY place Prisma is used for research data. No business rules here — the service decides
// WHAT to write; the repository just persists it atomically alongside its audit entry.

export type CreateResearchData = CreateResearchInput;
export type UpdateResearchData = UpdateResearchInput;

export interface ResearchRepository {
  findById(id: string): Promise<Research | null>;
  list(): Promise<Research[]>;
  /** Counts only — no research rows leave the database. */
  stats(): Promise<ResearchStats>;
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

const auditData = (audit: AuditContext, entityId: string) =>
  auditLogData('research', audit, entityId);

export class PrismaResearchRepository implements ResearchRepository {
  async findById(id: string): Promise<Research | null> {
    const row = await prisma.research.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async list(): Promise<Research[]> {
    const rows = await prisma.research.findMany({ orderBy: { sortOrder: 'asc' } });
    return rows.map(toDomain);
  }

  async stats(): Promise<ResearchStats> {
    // Batched into one round trip. Areas come back ordered by their lowest `sortOrder`, which is
    // where each area first appears in `list()` — the admin's arrangement, preserved.
    const [total, byArea] = await prisma.$transaction([
      prisma.research.count(),
      prisma.research.groupBy({
        by: ['area'],
        _count: true,
        _min: { sortOrder: true },
        orderBy: { _min: { sortOrder: 'asc' } },
      }),
    ]);
    return { total, byArea: byArea.map((row) => ({ area: row.area, count: row._count })) };
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
      await tx.auditLog.create({ data: auditData(input.audit, row.id) });
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
        // Prisma leaves a column untouched when its value is `undefined`, so the partial
        // input maps straight through — an absent key is not a cleared column.
        data: {
          title: input.data.title,
          summary: input.data.summary,
          area: input.data.area,
          link: input.data.link,
          sortOrder: input.data.sortOrder,
        },
      });
      await tx.auditLog.create({ data: auditData(input.audit, row.id) });
      return row;
    });
    return toDomain(updated);
  }

  async deleteWithAudit(input: { id: string; audit: AuditContext }): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.research.delete({ where: { id: input.id } });
      await tx.auditLog.create({ data: auditData(input.audit, input.id) });
    });
  }
}
