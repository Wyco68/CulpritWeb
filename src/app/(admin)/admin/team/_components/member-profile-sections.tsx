// Deep, client-safe imports only: this renders inside the Team screen's popup (a client
// component), and the module barrels also export Prisma-backed services.
import { ProjectsAdmin } from '@/modules/projects/ui/projects-admin';
import { CoursesAdmin } from '@/modules/teaching/ui/courses-admin';
import { CvEntriesAdmin } from '@/modules/teaching/ui/cv-entries-admin';
import { CV_SECTIONS, CV_SECTION_LABELS, type CvSection } from '@/modules/teaching/teaching.types';
import { PROFILE_SECTIONS, type ProfileSection } from '@/modules/shared/lib/profile-sections';
import { SectionVisibility } from './section-visibility';
import type { MemberProfileData } from './member-profile-data';

type Member = { id: string; name: string; hiddenSections: ProfileSection[] };

/**
 * The CV lists in the public page's order — most important first — so the editor and the profile
 * read top to bottom alike. Every list is editable whatever is hidden: hiding is about the public
 * page only, and a hidden list keeps its entries for when it is switched back on (ADR-020).
 */
const CV_ORDER = PROFILE_SECTIONS.filter((section): section is CvSection =>
  (CV_SECTIONS as readonly string[]).includes(section),
);

/** The full page's jump list, mirroring what `MemberProfileSections` renders. */
export function memberProfileNav() {
  return [
    { id: 'visibility', label: 'Shown on profile' },
    ...CV_ORDER.map((section) => ({ id: `cv-${section}`, label: CV_SECTION_LABELS[section] })),
    { id: 'courses', label: 'Courses' },
    { id: 'projects', label: 'Projects' },
  ];
}

/** One member's section switches, CV lists, courses and projects — the popup and the full page. */
export function MemberProfileSections({
  member,
  data,
}: {
  member: Member;
  data: MemberProfileData;
}) {
  return (
    <>
      <SectionVisibility key={member.id} member={member} />
      <CvEntriesAdmin
        teamMemberId={member.id}
        sections={CV_ORDER}
        hiddenSections={member.hiddenSections}
        entries={data.cvEntries}
      />
      <CoursesAdmin
        teamMemberId={member.id}
        courses={data.courses}
        hidden={member.hiddenSections.includes('courses')}
      />
      <ProjectsAdmin teamMemberId={member.id} projects={data.projects} />
    </>
  );
}
