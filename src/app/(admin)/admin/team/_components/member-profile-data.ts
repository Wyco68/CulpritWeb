import { getProjectService, type Project } from '@/modules/projects';
import type { TeamMember } from '@/modules/research-groups';
import { getCourseService, getCvEntryService, type Course, type CvEntry } from '@/modules/teaching';

export type MemberProfileData = { cvEntries: CvEntry[]; courses: Course[]; projects: Project[] };

/**
 * Everything a member's profile editor lists. Read from the teaching and projects services
 * directly rather than through `findProfile`, which drops the member's hidden sections on the way
 * out (ADR-020). That filtering is right for the public page and wrong here: a hidden section's
 * rows still exist, and the admin has to be able to see and edit them.
 */
export async function loadMemberProfileData(
  member: Pick<TeamMember, 'id'>,
): Promise<MemberProfileData> {
  const [entries, courses, projects] = await Promise.all([
    getCvEntryService().listForMember(member.id),
    getCourseService().listForMember(member.id),
    getProjectService().listForMember(member.id),
  ]);
  return {
    cvEntries: entries.ok ? entries.data : [],
    courses: courses.ok ? courses.data : [],
    projects: projects.ok ? projects.data : [],
  };
}
