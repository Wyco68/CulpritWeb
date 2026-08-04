import { getResearchService } from '@/modules/research';
import { apiUnexpected, respond } from '@/modules/shared/lib/api-response';

// Public: list research works, ordered by sortOrder.
export async function GET() {
  try {
    const result = await getResearchService().list();
    return respond(result);
  } catch (error) {
    return apiUnexpected(error);
  }
}
