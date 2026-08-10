import { getResearchService } from '@/modules/research';
import { apiUnexpected, respond } from '@/modules/shared/lib/api-response';

// Public: list research works, ordered by sortOrder.
// ISR-style route cache: served from the same on-demand cache Next manages for pages, so
// `revalidatePath('/api/research')` (see modules/shared/lib/revalidate) purges it on admin writes.
// The 1h figure is a safety-net ceiling only, matching the public layout's fallback TTL.
export const revalidate = 3600;

export async function GET() {
  try {
    const result = await getResearchService().list();
    return respond(result);
  } catch (error) {
    return apiUnexpected(error);
  }
}
