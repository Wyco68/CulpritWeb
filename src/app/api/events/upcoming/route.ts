import { getUpcomingEventsService, toAppointmentView } from '@/modules/appointments';
import { mapResult } from '@/modules/shared/lib/result';
import { apiUnexpected, respond } from '@/modules/shared/lib/api-response';

// Public: upcoming events (admin-declared appointments, `scheduled` and in the future), gated by
// the admin's upcoming_events_visible setting. Never 403s — when the setting is off this returns
// 200 with `{ visible: false, events: [] }` so the public tab can render an explicit "not shown" state.
// ISR-style route cache: purged by `revalidatePath('/api/events/upcoming')` on admin appointment/
// settings writes (see modules/shared/lib/revalidate). Shorter 300s ceiling (vs. the usual 3600s)
// because "upcoming" is time-sensitive — a scheduled appointment can pass into the past between
// invalidations, so this bounds how long a stale-but-now-past event could still be served.
export const revalidate = 300;

export async function GET() {
  try {
    const result = await getUpcomingEventsService().getUpcomingEvents();
    return respond(
      mapResult(result, (data) => ({
        visible: data.visible,
        events: data.events.map(toAppointmentView),
      })),
    );
  } catch (error) {
    return apiUnexpected(error);
  }
}
