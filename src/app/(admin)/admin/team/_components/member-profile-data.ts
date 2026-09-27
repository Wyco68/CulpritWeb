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

/** Group rows by the member they belong to, keeping each member's rows in the order they came. */
function byMember<T extends { teamMemberId: string }>(rows: T[]): Record<string, T[]> {
  const grouped: Record<string, T[]> = {};
  for (const row of rows) (grouped[row.teamMemberId] ??= []).push(row);
  return grouped;
}

/**
 * `loadMemberProfileData` for every member at once: three queries in total, however many members
 * there are. The Team screen opens any member's profile popup without a round trip, so it needs all
 * of them — read one member at a time, that was three queries per member (24 for a lab of eight).
 */
export async function loadMemberProfilesData(
  members: Pick<TeamMember, 'id'>[],
): Promise<Record<string, MemberProfileData>> {
  const ids = members.map((member) => member.id);
  if (ids.length === 0) return {};
  const [entries, courses, projects] = await Promise.all([
    getCvEntryService().listForMembers(ids),
    getCourseService().listForMembers(ids),
    getProjectService().listForMembers(ids),
  ]);
  const entriesBy = byMember(entries.ok ? entries.data : []);
  const coursesBy = byMember(courses.ok ? courses.data : []);
  const projectsBy = byMember(projects.ok ? projects.data : []);
  return Object.fromEntries(
    ids.map((id) => [
      id,
      {
        cvEntries: entriesBy[id] ?? [],
        courses: coursesBy[id] ?? [],
        projects: projectsBy[id] ?? [],
      },
    ]),
  );
}
