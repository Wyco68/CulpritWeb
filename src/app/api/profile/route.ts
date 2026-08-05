import { getProfileService } from '@/modules/profile';
import { apiUnexpected, respond } from '@/modules/shared/lib/api-response';

// Public: get the professor's structured bio/profile (singleton).
export async function GET() {
  try {
    const result = await getProfileService().getProfile();
    return respond(result);
  } catch (error) {
    return apiUnexpected(error);
  }
}
