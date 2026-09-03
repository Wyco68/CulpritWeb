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

/**
 * A group without its members, carrying only how many there are.
 *
 * The admin Team screen and the dashboard need a group's identity plus its size, never the member
 * rows themselves — the members are listed separately, from the team-member table. Fetching
 * `ResearchGroup` there pulled every member row a second time purely to call `.length` on it.
 * This is a distinct type rather than an optional `teamMembers` on `ResearchGroup` so a consumer
 * can never be handed a group whose member list is silently absent.
 */
export type ResearchGroupSummary = {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  createdAt: Date;
  updatedAt: Date;
};

/** Append-only audit context supplied by the service, persisted by the repository. */
export type AuditContext = {
  actor: string;
  action: string;
  metadata?: Record<string, unknown>;
};
