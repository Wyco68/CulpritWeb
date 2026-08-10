import { getProfileService } from '@/modules/profile';
import { apiUnexpected, respond } from '@/modules/shared/lib/api-response';

// Public: get the professor's structured bio/profile (singleton).
// ISR-style route cache: purged by `revalidatePath('/api/profile')` alongside the layout on
// profile saves (see modules/shared/lib/revalidate). 1h ceiling is a safety net only.
export const revalidate = 3600;

export async function GET() {
  try {
    const result = await getProfileService().getProfile();
    return respond(result);
  } catch (error) {
    return apiUnexpected(error);
  }
}
