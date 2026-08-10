import { getPublicationService } from '@/modules/publications';
import { apiUnexpected, respond } from '@/modules/shared/lib/api-response';

// Public: list publications, ordered by year desc then createdAt desc.
// ISR-style route cache: purged by `revalidatePath('/api/publications')` on admin writes (see
// modules/shared/lib/revalidate). 1h ceiling is a safety net, not the primary freshness path.
export const revalidate = 3600;

export async function GET() {
  try {
    const result = await getPublicationService().list();
    return respond(result);
  } catch (error) {
    return apiUnexpected(error);
  }
}
