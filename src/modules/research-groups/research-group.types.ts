import type { TeamMember } from './team-member.types';

// Domain model — the shape services/routes work with. Mapped from the Prisma row inside the
// repository so Prisma's generated types never leak across the service boundary.
export type ResearchGroup = {
  id: string;
  name: string;
  description: string;
  teamMembers: TeamMember[];
  createdAt: Date;
  updatedAt: Date;
};

/** Append-only audit context supplied by the service, persisted by the repository. */
export type AuditContext = {
  actor: string;
  action: string;
  metadata?: Record<string, unknown>;
};
