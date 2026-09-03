import { prisma } from '@/modules/shared/lib/prisma';
import type {
  Prisma,
  ResearchGroup as PrismaResearchGroup,
  TeamMember as PrismaTeamMember,
} from '@prisma/client';
import type { AuditContext, ResearchGroup, ResearchGroupSummary } from './research-group.types';
import type { CreateResearchGroupInput, UpdateResearchGroupInput } from './research-group.schema';
import { toDomain as toTeamMemberDomain } from './team-member.repository';

// The ONLY place Prisma is used for research-group data. No business rules here — the service
// decides WHAT to write; the repository just persists it atomically alongside its audit entry.
// Team members are FK'd to a group (nullable, SetNull on group delete) — reads include them
// ordered by sortOrder; the team-member repository owns their own CRUD.

export type CreateResearchGroupData = CreateResearchGroupInput;
export type UpdateResearchGroupData = UpdateResearchGroupInput;

type RowWithMembers = PrismaResearchGroup & { teamMembers: PrismaTeamMember[] };

export interface ResearchGroupRepository {
  findById(id: string): Promise<ResearchGroup | null>;
  /** Ordered by createdAt asc; each group includes its team members ordered by sortOrder. */
  list(): Promise<ResearchGroup[]>;
  /**
   * Same order as `list()`, but each group carries only how many members it has. For callers that
   * render a group's size rather than its people — the member rows never cross the wire.
   */
  listWithMemberCounts(): Promise<ResearchGroupSummary[]>;
  createWithAudit(input: {
    data: CreateResearchGroupData;
    audit: AuditContext;
  }): Promise<ResearchGroup>;
  updateWithAudit(input: {
    id: string;
    data: UpdateResearchGroupData;
    audit: AuditContext;
  }): Promise<ResearchGroup>;
  deleteWithAudit(input: { id: string; audit: AuditContext }): Promise<void>;
}

const teamMembersInclude = { teamMembers: { orderBy: { sortOrder: 'asc' as const } } };

function toDomain(row: RowWithMembers): ResearchGroup {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    teamMembers: row.teamMembers.map(toTeamMemberDomain),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function auditCreateInput(audit: AuditContext, entityId: string): Prisma.AuditLogCreateInput {
  return {
    actor: audit.actor,
    action: audit.action,
    entityType: 'research_group',
    entityId,
    metadata: (audit.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
  };
}

export class PrismaResearchGroupRepository implements ResearchGroupRepository {
  async findById(id: string): Promise<ResearchGroup | null> {
    const row = await prisma.researchGroup.findUnique({ where: { id }, include: teamMembersInclude });
    return row ? toDomain(row) : null;
  }

  async list(): Promise<ResearchGroup[]> {
    const rows = await prisma.researchGroup.findMany({
      orderBy: { createdAt: 'asc' },
      include: teamMembersInclude,
    });
    return rows.map(toDomain);
  }

  async listWithMemberCounts(): Promise<ResearchGroupSummary[]> {
    // `_count` is a correlated COUNT in the same statement — one row per group, no member rows.
    const rows = await prisma.researchGroup.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { teamMembers: true } },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      memberCount: row._count.teamMembers,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  async createWithAudit(input: {
    data: CreateResearchGroupData;
    audit: AuditContext;
  }): Promise<ResearchGroup> {
    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.researchGroup.create({
        data: { name: input.data.name, description: input.data.description },
        include: teamMembersInclude,
      });
      await tx.auditLog.create({ data: auditCreateInput(input.audit, row.id) });
      return row;
    });
    return toDomain(created);
  }

  async updateWithAudit(input: {
    id: string;
    data: UpdateResearchGroupData;
    audit: AuditContext;
  }): Promise<ResearchGroup> {
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.researchGroup.update({
        where: { id: input.id },
        data: {
          ...(input.data.name !== undefined ? { name: input.data.name } : {}),
          ...(input.data.description !== undefined ? { description: input.data.description } : {}),
        },
        include: teamMembersInclude,
      });
      await tx.auditLog.create({ data: auditCreateInput(input.audit, row.id) });
      return row;
    });
    return toDomain(updated);
  }

  async deleteWithAudit(input: { id: string; audit: AuditContext }): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.researchGroup.delete({ where: { id: input.id } });
      await tx.auditLog.create({ data: auditCreateInput(input.audit, input.id) });
    });
  }
}
