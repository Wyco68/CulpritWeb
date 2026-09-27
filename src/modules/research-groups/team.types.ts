// Domain model for an admin-defined team (ADR-020). Mapped from the Prisma row inside the
// repository so Prisma's generated types never leak across the service boundary.

export type Team = {
  id: string;
  name: string;
  /** Position on the public Team tab; lower first, ties broken by name. */
  sortOrder: number;
  /** How many members are listed under it — shown before a delete leaves them without a team. */
  memberCount: number;
  createdAt: Date;
  updatedAt: Date;
};

/** The slice of a team that travels with each member. */
export type TeamRef = Pick<Team, 'id' | 'name' | 'sortOrder'>;

export type { AuditContext } from '@/modules/shared/lib/audit';
