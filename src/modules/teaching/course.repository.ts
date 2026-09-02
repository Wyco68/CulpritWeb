import { prisma } from '@/modules/shared/lib/prisma';
import type { Prisma, Course as PrismaCourse } from '@prisma/client';
import type { AuditContext, Course } from './teaching.types';
import type { CreateCourseInput, UpdateCourseInput } from './teaching.schema';

// The ONLY place Prisma is used for course data. No business rules here — the service decides
// WHAT to write; the repository just persists it atomically alongside its audit entry.

export interface CourseRepository {
  findById(id: string): Promise<Course | null>;
  list(): Promise<Course[]>;
  createWithAudit(input: { data: CreateCourseInput; audit: AuditContext }): Promise<Course>;
  updateWithAudit(input: {
    id: string;
    data: UpdateCourseInput;
    audit: AuditContext;
  }): Promise<Course>;
  deleteWithAudit(input: { id: string; audit: AuditContext }): Promise<void>;
}

function toDomain(row: PrismaCourse): Course {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    level: row.level,
    term: row.term,
    description: row.description,
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
    entityType: 'course',
    entityId,
    metadata: (audit.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
  };
}

export class PrismaCourseRepository implements CourseRepository {
  async findById(id: string): Promise<Course | null> {
    const row = await prisma.course.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async list(): Promise<Course[]> {
    // `sortOrder` is the admin's arrangement; `title` only breaks ties so equal-ordered rows
    // don't shuffle between requests. The public tab groups by `level` in render order.
    const rows = await prisma.course.findMany({ orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }] });
    return rows.map(toDomain);
  }

  async createWithAudit(input: { data: CreateCourseInput; audit: AuditContext }): Promise<Course> {
    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.course.create({
        data: {
          code: input.data.code ?? null,
          title: input.data.title,
          level: input.data.level,
          term: input.data.term ?? null,
          description: input.data.description ?? null,
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
    data: UpdateCourseInput;
    audit: AuditContext;
  }): Promise<Course> {
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.course.update({
        where: { id: input.id },
        data: {
          ...(input.data.code !== undefined ? { code: input.data.code ?? null } : {}),
          ...(input.data.title !== undefined ? { title: input.data.title } : {}),
          ...(input.data.level !== undefined ? { level: input.data.level } : {}),
          ...(input.data.term !== undefined ? { term: input.data.term ?? null } : {}),
          ...(input.data.description !== undefined
            ? { description: input.data.description ?? null }
            : {}),
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
      await tx.course.delete({ where: { id: input.id } });
      await tx.auditLog.create({ data: auditCreateInput(input.audit, input.id) });
    });
  }
}
