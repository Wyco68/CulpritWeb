// Deep, client-safe imports only: this renders inside the Team screen's popup (a client
// component), and the module barrels also export Prisma-backed services.
import { ProjectsAdmin } from '@/modules/projects/ui/projects-admin';
import { CoursesAdmin } from '@/modules/teaching/ui/courses-admin';
import { CvEntriesAdmin } from '@/modules/teaching/ui/cv-entries-admin';
import { CV_SECTIONS, CV_SECTION_LABELS } from '@/modules/teaching/teaching.types';
import { TEAM_KIND_RULES, allowsCourses, type TeamKind } from '@/modules/shared/lib/team-kind';
import type { MemberProfileData } from './member-profile-data';

type Member = { id: string; teamKind: TeamKind };

/** Which CV lists this member edits, which are retired (delete-only), and whether courses show. */
function layoutFor(member: Member, data: MemberProfileData) {
  const rules = TEAM_KIND_RULES[member.teamKind];
  const editableSections = CV_SECTIONS.filter((section) => rules.cvSections.includes(section));
  // Sections this team cannot have but which still hold rows: shown last, delete-only.
  const retiredSections = CV_SECTIONS.filter(
    (section) =>
      !rules.cvSections.includes(section) &&
      data.cvEntries.some((entry) => entry.section === section),
  );
  const coursesAllowed = allowsCourses(member.teamKind);
  return {
    editableSections,
    retiredSections,
    coursesAllowed,
    showCourses: coursesAllowed || data.courses.length > 0,
  };
}

/** The full page's jump list, mirroring what `MemberProfileSections` renders. */
export function memberProfileNav(member: Member, data: MemberProfileData) {
  const { editableSections, retiredSections, showCourses } = layoutFor(member, data);
  return [
    ...[...editableSections, ...retiredSections].map((section) => ({
      id: `cv-${section}`,
      label: CV_SECTION_LABELS[section],
    })),
    ...(showCourses ? [{ id: 'courses', label: 'Courses' }] : []),
    { id: 'projects', label: 'Projects' },
  ];
}

/** One member's CV lists, courses and projects — the popup on /admin/team and the full page. */
export function MemberProfileSections({
  member,
  data,
}: {
  member: Member;
  data: MemberProfileData;
}) {
  const { editableSections, retiredSections, coursesAllowed } = layoutFor(member, data);
  return (
    <>
      <CvEntriesAdmin
        teamMemberId={member.id}
        sections={editableSections}
        retiredSections={retiredSections}
        entries={data.cvEntries}
      />
      <CoursesAdmin teamMemberId={member.id} courses={data.courses} allowed={coursesAllowed} />
      {/* Every team may have projects (TEAM_KIND_RULES), so this one is not gated. */}
      <ProjectsAdmin teamMemberId={member.id} projects={data.projects} />
    </>
  );
}
