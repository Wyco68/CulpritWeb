import { prisma } from '@/modules/shared/lib/prisma';
import { auditLogData } from '@/modules/shared/lib/audit';
import type { Prisma, Team as PrismaTeam } from '@prisma/client';
import type { AuditContext, Team } from './team.types';
import type { CreateTeamInput, UpdateTeamInput } from './team.schema';

// The ONLY place Prisma is used for team data. No business rules here — the service decides WHAT
// to write; the repository persists it atomically alongside its audit entry.

export interface TeamRepository {
  findById(id: string): Promise<Team | null>;
  /** Case-insensitive, so "research team" cannot sit beside "Research Team". */
  findByName(name: string): Promise<Team | null>;
  /** In display order. */
  list(): Promise<Team[]>;
  createWithAudit(input: { data: CreateTeamInput; audit: AuditContext }): Promise<Team>;
  updateWithAudit(input: { id: string; data: UpdateTeamInput; audit: AuditContext }): Promise<Team>;
  /** Members stay; the foreign key's ON DELETE SET NULL leaves them without a team. */
  deleteWithAudit(input: { id: string; audit: AuditContext }): Promise<void>;
}

const WITH_COUNT = { _count: { select: { members: true } } } as const;

function toDomain(row: PrismaTeam & { _count: { members: number } }): Team {
  return {
    id: row.id,
    name: row.name,
    sortOrder: row.sortOrder,
    memberCount: row._count.members,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Shared by every read that orders teams, so the admin list and the public tab never disagree. */
export const TEAM_ORDER: Prisma.TeamOrderByWithRelationInput[] = [
  { sortOrder: 'asc' },
  { name: 'asc' },
];

const auditData = (audit: AuditContext, entityId: string) => auditLogData('team', audit, entityId);

export class PrismaTeamRepository implements TeamRepository {
  async findById(id: string): Promise<Team | null> {
    const row = await prisma.team.findUnique({ where: { id }, include: WITH_COUNT });
    return row ? toDomain(row) : null;
  }

  async findByName(name: string): Promise<Team | null> {
    const row = await prisma.team.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
      include: WITH_COUNT,
    });
    return row ? toDomain(row) : null;
  }

  async list(): Promise<Team[]> {
    const rows = await prisma.team.findMany({ orderBy: TEAM_ORDER, include: WITH_COUNT });
    return rows.map(toDomain);
  }

  async createWithAudit(input: { data: CreateTeamInput; audit: AuditContext }): Promise<Team> {
    return prisma.$transaction(async (tx) => {
      const row = await tx.team.create({
        data: { name: input.data.name, sortOrder: input.data.sortOrder ?? 0 },
        include: WITH_COUNT,
      });
      await tx.auditLog.create({ data: auditData(input.audit, row.id) });
      return toDomain(row);
    });
  }

  async updateWithAudit(input: {
    id: string;
    data: UpdateTeamInput;
    audit: AuditContext;
  }): Promise<Team> {
    return prisma.$transaction(async (tx) => {
      const row = await tx.team.update({
        where: { id: input.id },
        data: { name: input.data.name, sortOrder: input.data.sortOrder },
        include: WITH_COUNT,
      });
      await tx.auditLog.create({ data: auditData(input.audit, row.id) });
      return toDomain(row);
    });
  }

  async deleteWithAudit(input: { id: string; audit: AuditContext }): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.team.delete({ where: { id: input.id } });
      await tx.auditLog.create({ data: auditData(input.audit, input.id) });
    });
  }
}
