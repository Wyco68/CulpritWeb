import { getEventService, splitByTiming } from '@/modules/events';
import { mapResult } from '@/modules/shared/lib/result';
import { apiUnexpected, respondPublicCache } from '@/modules/shared/lib/api-response';

// Public: every event, already split into the two halves the Events tab renders — upcoming first
// (soonest first) and past (most recent first). Always 200 with empty arrays when there are none.
//
// Replaced `/api/events/upcoming` on 2026-09-01, when events stopped being admin-declared
// appointments. Two changes came with it: past events are now published content rather than
// something to hide, and there is no per-row visibility flag left to filter on — every event is
// public.
//
// ISR-style route cache: purged by `revalidatePath('/api/events')` on admin event writes (see
// modules/shared/lib/revalidate). The 300s ceiling (vs. the usual 3600s elsewhere) is kept from
// the route this replaced, for the same reason: the upcoming/past boundary is computed against the
// clock at render time, so a cached response can only be trusted for as long as it is plausible
// that nothing has crossed it.
export const revalidate = 300;

export async function GET() {
  try {
    const result = await getEventService().list();
    return respondPublicCache(
      mapResult(result, (events) => splitByTiming(events)),
      { browserTtl: 60, edgeTtl: 300, staleWhileRevalidate: 60 },
    );
  } catch (error) {
    return apiUnexpected(error);
  }
}
