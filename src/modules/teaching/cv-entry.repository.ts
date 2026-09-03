import { prisma } from '@/modules/shared/lib/prisma';
import type { Prisma, CvEntry as PrismaCvEntry } from '@prisma/client';
import type { AuditContext, CvEntry, CvEntryStats, CvSection } from './teaching.types';
import type { CreateCvEntryInput, UpdateCvEntryInput } from './teaching.schema';

// The ONLY place Prisma is used for CV entries. No business rules here — the service decides WHAT
// to write; the repository just persists it atomically alongside its audit entry.

export interface CvEntryRepository {
  findById(id: string): Promise<CvEntry | null>;
  /** Every entry, ordered by section then the admin's arrangement. */
  list(): Promise<CvEntry[]>;
  /** Only the given sections — what each public tab actually needs. */
  listBySections(sections: readonly CvSection[]): Promise<CvEntry[]>;
  /** Counts only — how many entries there are and which sections are populated. */
  stats(): Promise<CvEntryStats>;
  createWithAudit(input: { data: CreateCvEntryInput; audit: AuditContext }): Promise<CvEntry>;
  updateWithAudit(input: {
    id: string;
    data: UpdateCvEntryInput;
    audit: AuditContext;
  }): Promise<CvEntry>;
  deleteWithAudit(input: { id: string; audit: AuditContext }): Promise<void>;
}

function toDomain(row: PrismaCvEntry): CvEntry {
  return {
    id: row.id,
    section: row.section,
    title: row.title,
    subtitle: row.subtitle,
    year: row.year,
    description: row.description,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function auditCreateInput(audit: AuditContext, entityId: string): Prisma.AuditLogCreateInput {
  return {
    actor: audit.actor,
    action: audit.action,
    entityType: 'cv_entry',
    entityId,
    metadata: (audit.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
  };
}

// `sortOrder` is scoped per section, so section has to lead the ordering or two sections'
// positions interleave. `title` only breaks ties, so equal-ordered rows don't shuffle between
// requests.
const LIST_ORDER: Prisma.CvEntryOrderByWithRelationInput[] = [
  { section: 'asc' },
  { sortOrder: 'asc' },
  { title: 'asc' },
];

export class PrismaCvEntryRepository implements CvEntryRepository {
  async findById(id: string): Promise<CvEntry | null> {
    const row = await prisma.cvEntry.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async list(): Promise<CvEntry[]> {
    const rows = await prisma.cvEntry.findMany({ orderBy: LIST_ORDER });
    return rows.map(toDomain);
  }

  async listBySections(sections: readonly CvSection[]): Promise<CvEntry[]> {
    if (sections.length === 0) return [];
    const rows = await prisma.cvEntry.findMany({
      where: { section: { in: [...sections] } },
      orderBy: LIST_ORDER,
    });
    return rows.map(toDomain);
  }

  async stats(): Promise<CvEntryStats> {
    // Batched into one round trip. The groupBy is a DISTINCT over the (section, sortOrder) index;
    // it answers "which sections have anything in them" without reading a single entry.
    const [total, sections] = await prisma.$transaction([
      prisma.cvEntry.count(),
      prisma.cvEntry.groupBy({ by: ['section'] }),
    ]);
    return { total, sections: sections.map((row) => row.section) };
  }

  async createWithAudit(input: {
    data: CreateCvEntryInput;
    audit: AuditContext;
  }): Promise<CvEntry> {
    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.cvEntry.create({
        data: {
          section: input.data.section,
          title: input.data.title,
          subtitle: input.data.subtitle ?? null,
          year: input.data.year ?? null,
          description: input.data.description ?? null,
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
    data: UpdateCvEntryInput;
    audit: AuditContext;
  }): Promise<CvEntry> {
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.cvEntry.update({
        where: { id: input.id },
        data: {
          ...(input.data.section !== undefined ? { section: input.data.section } : {}),
          ...(input.data.title !== undefined ? { title: input.data.title } : {}),
          ...(input.data.subtitle !== undefined ? { subtitle: input.data.subtitle ?? null } : {}),
          ...(input.data.year !== undefined ? { year: input.data.year ?? null } : {}),
          ...(input.data.description !== undefined
            ? { description: input.data.description ?? null }
            : {}),
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
      await tx.cvEntry.delete({ where: { id: input.id } });
      await tx.auditLog.create({ data: auditCreateInput(input.audit, input.id) });
    });
  }
}
