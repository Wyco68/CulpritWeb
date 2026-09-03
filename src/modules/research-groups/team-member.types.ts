// Domain model — the shape services/routes work with. Mapped from the Prisma row inside the
// repository so Prisma's generated types never leak across the service boundary.
export type TeamMember = {
  id: string;
  name: string;
  role: string;
  bio: string | null;
  photoUrl: string | null;
  researchGroupId: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

/** Headline counts for the admin dashboard, computed in SQL rather than by listing every row. */
export type TeamMemberStats = {
  total: number;
  /** Members with no research group — the public tab lists them on their own. */
  ungrouped: number;
};

/** Append-only audit context supplied by the service, persisted by the repository. */
export type AuditContext = {
  actor: string;
  action: string;
  metadata?: Record<string, unknown>;
};
