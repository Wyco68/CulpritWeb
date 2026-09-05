import { getCourseService, getCvEntryService, TEACHING_SECTIONS } from '@/modules/teaching';
import { apiUnexpected, respondPublicCache } from '@/modules/shared/lib/api-response';

// Public: everything the Teaching tab renders — courses plus the two teaching CV lists — in one
// response, so a consumer doesn't have to know that they come from two tables.
//
// ISR-style route cache: purged by `revalidatePath('/api/teaching')` on admin writes (see
// modules/shared/lib/revalidate). The 1h figure is a safety-net ceiling only, matching the other
// public GET routes — teaching content changes a few times a year.
export const revalidate = 3600;

export async function GET() {
  try {
    const [courses, entries] = await Promise.all([
      getCourseService().list(),
      getCvEntryService().listBySections(TEACHING_SECTIONS),
    ]);

    if (!courses.ok)
      return respondPublicCache(courses, {
        browserTtl: 300,
        edgeTtl: 3600,
        staleWhileRevalidate: 300,
      });
    if (!entries.ok)
      return respondPublicCache(entries, {
        browserTtl: 300,
        edgeTtl: 3600,
        staleWhileRevalidate: 300,
      });

    return respondPublicCache(
      { ok: true as const, data: { courses: courses.data, entries: entries.data } },
      { browserTtl: 300, edgeTtl: 3600, staleWhileRevalidate: 300 },
    );
  } catch (error) {
    return apiUnexpected(error);
  }
}
