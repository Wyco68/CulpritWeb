import { getResearchGroupService } from '@/modules/research-groups';
import { apiUnexpected, respond } from '@/modules/shared/lib/api-response';

// Public: list research groups, each including its team members (ordered by sortOrder).
export async function GET() {
  try {
    const result = await getResearchGroupService().list();
    return respond(result);
  } catch (error) {
    return apiUnexpected(error);
  }
}
