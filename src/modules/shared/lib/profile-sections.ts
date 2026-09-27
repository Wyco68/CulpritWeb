// Type-only import: erased at build, so this file has NO runtime dependency on a domain module and
// both `research-groups` and `teaching` can import it without a module cycle.
import type { CvSection } from '@/modules/teaching';

// The sections of a member's public profile page that the admin can switch off per member
// (ADR-020). Replaced the fixed team rules of ADR-017: teams are now just admin-named groups, and
// what a profile shows is decided member by member.
//
// The order here IS the page order — most important first — and the order of the page's jump
// list. Biography and links are not listed: they show whenever they are filled in.

export const PROFILE_SECTIONS = [
  'research_interest',
  'publications',
  'research',
  'projects',
  'education',
  'invited_talk',
  'fellowship',
  'scholarship',
  'courses',
  'teaching_role',
  'teaching_award',
] as const satisfies readonly (CvSection | 'publications' | 'research' | 'projects' | 'courses')[];

export type ProfileSection = (typeof PROFILE_SECTIONS)[number];

/** Heading of each section, on the public profile and in the admin's visibility switches. */
export const PROFILE_SECTION_LABELS: Record<ProfileSection, string> = {
  research_interest: 'Research interests',
  publications: 'Publications',
  research: 'Research',
  projects: 'Projects',
  education: 'Education',
  invited_talk: 'Invited talks',
  fellowship: 'Fellowships & visiting appointments',
  scholarship: 'Scholarships & travel awards',
  courses: 'Courses',
  teaching_role: 'Teaching roles',
  teaching_award: 'Teaching awards',
};

/** Whether `section` shows on this member's profile. */
export function showsSection(
  member: { hiddenSections: readonly ProfileSection[] },
  section: ProfileSection,
): boolean {
  return !member.hiddenSections.includes(section);
}
