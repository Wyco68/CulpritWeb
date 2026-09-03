import type { Metadata } from 'next';
import { getProfileService, ProfileFieldsForm } from '@/modules/profile';
import {
  CoursesAdmin,
  CvEntriesAdmin,
  getCourseService,
  getCvEntryService,
  TEACHING_SECTIONS,
} from '@/modules/teaching';
import { AdminScreen } from '../_components/admin-screen';

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Admin — Teaching' };
}

// Mirrors the public Teaching tab. This screen used to own all seven CV sections, including the
// five that render on About and Research; it now owns only the two that appear on this tab.
const SECTIONS = [
  { id: 'intro', label: 'Introduction' },
  { id: 'courses', label: 'Courses' },
  { id: 'cv-teaching_role', label: 'Teaching roles' },
  { id: 'cv-teaching_award', label: 'Teaching awards' },
] as const;

const PROFILE_SECTIONS = [
  {
    id: 'intro',
    title: 'Introduction',
    description: 'Optional prose above the course list on the public Teaching tab.',
    fields: ['teachingIntro'],
  },
] as const;

export default async function AdminTeachingPage() {
  const [profileResult, coursesResult, entriesResult] = await Promise.all([
    getProfileService().getProfile(),
    getCourseService().list(),
    getCvEntryService().listBySections(TEACHING_SECTIONS),
  ]);

  return (
    <AdminScreen
      title="Teaching"
      intro="Everything on the public Teaching tab."
      sections={SECTIONS}
    >
      <ProfileFieldsForm
        profile={profileResult.ok ? profileResult.data : null}
        sections={PROFILE_SECTIONS}
      />
      <CoursesAdmin courses={coursesResult.ok ? coursesResult.data : []} />
      <CvEntriesAdmin
        sections={TEACHING_SECTIONS}
        entries={entriesResult.ok ? entriesResult.data : []}
      />
    </AdminScreen>
  );
}
