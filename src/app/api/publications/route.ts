import { getPublicationService } from '@/modules/publications';
import { apiUnexpected, respond } from '@/modules/shared/lib/api-response';

// Public: list publications, ordered by year desc then createdAt desc.
export async function GET() {
  try {
    const result = await getPublicationService().list();
    return respond(result);
  } catch (error) {
    return apiUnexpected(error);
  }
}
