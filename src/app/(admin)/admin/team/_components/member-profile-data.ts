import { getProjectService, type Project } from '@/modules/projects';
import type { TeamMember } from '@/modules/research-groups';
import { getCourseService, getCvEntryService, type Course, type CvEntry } from '@/modules/teaching';

export type MemberProfileData = { cvEntries: CvEntry[]; courses: Course[]; projects: Project[] };

/**
 * Everything a member's profile editor lists. Read from the teaching and projects services
 * directly rather than through `findProfile`, which gates rows by the member's team on the way
 * out (ADR-017). That gating is right for the public page and wrong here: rows written before a
 * team change still exist, and an admin screen that hid them would leave content nobody could
 * find or delete. The team decides only what can be *added*, which the services enforce on write.
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
