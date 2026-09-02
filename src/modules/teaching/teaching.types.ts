// Domain models — the shapes services/routes work with. Mapped from Prisma rows inside the
// repositories so Prisma's generated types never leak across the service boundary.

/**
 * Which list a CV entry belongs to. Owned here rather than imported from Prisma so nothing
 * generated crosses the service boundary — same convention the old appointment status used.
 *
 * The first five render on About, the last two on Teaching. That split is the whole reason the
 * seven Json columns became rows: a single whole-document profile PUT could not serve two pages.
 */
export const CV_SECTIONS = [
  'education',
  'fellowship',
  'scholarship',
  'research_interest',
  'invited_talk',
  'teaching_role',
  'teaching_award',
] as const;

export type CvSection = (typeof CV_SECTIONS)[number];

/** The sections the public About tab renders, in the order it renders them. */
export const ABOUT_SECTIONS = [
  'education',
  'fellowship',
  'scholarship',
  'research_interest',
  'invited_talk',
] as const satisfies readonly CvSection[];

/** The sections the public Teaching tab renders, in the order it renders them. */
export const TEACHING_SECTIONS = ['teaching_role', 'teaching_award'] as const satisfies readonly CvSection[];

/** Human-readable heading for each section, used on both the public tabs and the admin screen. */
export const CV_SECTION_LABELS: Record<CvSection, string> = {
  education: 'Education',
  fellowship: 'Fellowships & visiting appointments',
  scholarship: 'Scholarships & travel awards',
  research_interest: 'Research interests',
  invited_talk: 'Invited talks',
  teaching_role: 'Teaching roles',
  teaching_award: 'Teaching awards',
};

/**
 * One CV-style line. Every section carries exactly these fields — which is why this is one table
 * with a discriminator rather than seven near-identical tables.
 */
export type CvEntry = {
  id: string;
  section: CvSection;
  title: string;
  subtitle: string | null;
  year: string | null;
  description: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

export type Course = {
  id: string;
  code: string | null;
  title: string;
  level: string;
  term: string | null;
  description: string | null;
  link: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

/** Append-only audit context supplied by the service, persisted by the repository. */
export type AuditContext = {
  actor: string;
  action: string;
  metadata?: Record<string, unknown>;
};
