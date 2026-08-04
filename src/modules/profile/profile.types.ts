// Domain model — the shape services/routes work with. Mapped from the Prisma row inside the
// repository so Prisma's generated types never leak across the service boundary.

/** Flexible list-item shape shared by every CV-style Json field (education, awards, talks, …). */
export type ProfileListItem = {
  title: string;
  subtitle?: string;
  year?: string;
  description?: string;
};

export type Profile = {
  id: string;
  fullName: string;
  title: string;
  photoUrl: string | null;
  bio: string | null;
  positionAffiliation: string | null;
  education: ProfileListItem[] | null;
  fellowshipsVisiting: ProfileListItem[] | null;
  teachingRoles: ProfileListItem[] | null;
  teachingAwards: ProfileListItem[] | null;
  scholarshipsTravelAwards: ProfileListItem[] | null;
  researchInterests: ProfileListItem[] | null;
  researchStatement: string | null;
  invitedTalks: ProfileListItem[] | null;
  updatedAt: Date;
};

/** Append-only audit context supplied by the service, persisted by the repository. */
export type AuditContext = {
  actor: string;
  action: string;
  metadata?: Record<string, unknown>;
};
