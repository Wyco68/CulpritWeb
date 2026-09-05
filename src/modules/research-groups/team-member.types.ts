// Domain model — the shape services/routes work with. Mapped from the Prisma row inside the
// repository so Prisma's generated types never leak across the service boundary.
export type TeamMember = {
  id: string;
  name: string;
  /** What the person goes by, e.g. "Wyco". Optional — most people don't need one. */
  nickname: string | null;
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

export type { AuditContext } from '@/modules/shared/lib/audit';
