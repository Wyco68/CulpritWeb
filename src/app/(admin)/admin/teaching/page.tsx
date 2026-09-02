import type { Metadata } from 'next';
import { getCourseService, getCvEntryService, TeachingAdmin } from '@/modules/teaching';

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Admin — Teaching' };
}

export default async function AdminTeachingPage() {
  const [coursesResult, entriesResult] = await Promise.all([
    getCourseService().list(),
    // Every section, not just the teaching ones — this screen owns all seven CV lists, including
    // the five that render on About.
    getCvEntryService().list(),
  ]);

  return (
    <TeachingAdmin
      courses={coursesResult.ok ? coursesResult.data : []}
      entries={entriesResult.ok ? entriesResult.data : []}
    />
  );
}
