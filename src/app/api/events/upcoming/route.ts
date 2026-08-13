import { getUpcomingEventsService, toAppointmentView } from '@/modules/appointments';
import { mapResult } from '@/modules/shared/lib/result';
import { apiUnexpected, respondPublicCache } from '@/modules/shared/lib/api-response';

// Public: upcoming events — admin-declared appointments that are `scheduled`, in the future, and
// individually opted into public visibility (`isPublic`, admin-toggled per row). Always 200 with
// `{ events: [] }` when there are none to show, never a 403/empty-section flag.
// ISR-style route cache: purged by `revalidatePath('/api/events/upcoming')` on admin appointment
// writes (see modules/shared/lib/revalidate). Shorter 300s ceiling (vs. the usual 3600s) because
// "upcoming" is time-sensitive — a scheduled appointment can pass into the past between
// invalidations, so this bounds how long a stale-but-now-past event could still be served.
// Browser/edge TTLs mirror the "frequently changing public data" tier — shorter than the other
// public GET routes for the same time-sensitivity reason as the 300s `revalidate` above.
export const revalidate = 300;

export async function GET() {
  try {
    const result = await getUpcomingEventsService().getUpcomingEvents();
    return respondPublicCache(
      mapResult(result, (data) => ({
        events: data.events.map(toAppointmentView),
      })),
      { browserTtl: 60, edgeTtl: 300, staleWhileRevalidate: 60 },
    );
  } catch (error) {
    return apiUnexpected(error);
  }
}
