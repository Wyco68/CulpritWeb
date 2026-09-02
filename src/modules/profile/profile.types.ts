// Domain model — the shape services/routes work with. Mapped from the Prisma row inside the
// repository so Prisma's generated types never leak across the service boundary.
//
// The seven CV-style list fields that used to live here as Json columns moved to the `teaching`
// module's `cv_entry` table on 2026-09-02 (ADR-012). What is left is the singleton identity and
// prose: name, title, photo, bio, position, research statement and the two profile links.

export type Profile = {
  id: string;
  fullName: string;
  title: string;
  photoUrl: string | null;
  bio: string | null;
  positionAffiliation: string | null;
  researchStatement: string | null;
  linkedinUrl: string | null;
  googleScholarUrl: string | null;
  updatedAt: Date;
};

/** Append-only audit context supplied by the service, persisted by the repository. */
export type AuditContext = {
  actor: string;
  action: string;
  metadata?: Record<string, unknown>;
};
