import type { Course, CvEntry } from '@/modules/teaching';
import type { Project } from '@/modules/projects';
import type { ProfileSection } from '@/modules/shared/lib/profile-sections';
import type { TeamRef } from './team.types';

// Domain model — the shape services/routes work with. Mapped from the Prisma row inside the
// repository so Prisma's generated types never leak across the service boundary.
export type TeamMember = {
  id: string;
  name: string;
  /** Byline form of the name, e.g. "J. Jaimunk". Byline names are matched against it and `name`. */
  citationName: string | null;
  role: string;
  affiliation: string | null;
  bio: string | null;
  photoUrl: string | null;
  /** The admin-defined team they are listed under, or null (ADR-020). */
  team: TeamRef | null;
  /** Profile sections switched off for this member. Empty shows everything with content. */
  hiddenSections: ProfileSection[];
  /**
   * The lab director, featured on their own at the top of the Team tab. At most one member has
   * it; the list puts them first.
   */
  isDirector: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * One external profile link on a member's page — "LinkedIn", "GitHub", "ORCID", whatever the admin
 * typed. Replaced the fixed `linkedinUrl`/`googleScholarUrl` columns. Edited as part of the member,
 * the way `PublicationAuthor` rows are edited as part of their publication.
 */
export type MemberLink = {
  id: string;
  label: string;
  url: string;
  sortOrder: number;
};

/**
 * Everything a member's public profile page renders.
 *
 * The CV, course and project arrays are ALREADY FILTERED by the member's `hiddenSections`: a hidden
 * section keeps its rows — nothing is deleted, so switching it back on restores them — they simply
 * are not returned here, so the page can render this straight through. Research and publications
 * are resolved from bylines by the page, which checks the same list.
 */
export type TeamMemberProfile = {
  member: TeamMember;
  links: MemberLink[];
  cvEntries: CvEntry[];
  courses: Course[];
  projects: Project[];
};

/** Headline counts for the admin dashboard, computed in SQL rather than by listing every row. */
export type TeamMemberStats = {
  total: number;
};

export type { AuditContext } from '@/modules/shared/lib/audit';
