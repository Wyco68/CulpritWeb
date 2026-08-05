import type { NextRequest } from 'next/server';
import { getTeamMemberService, listTeamMembersQuerySchema } from '@/modules/research-groups';
import { apiUnexpected, apiValidationError, respond } from '@/modules/shared/lib/api-response';

// Public: list team members, ordered by sortOrder. Optional `?groupId=` filter.
export async function GET(request: NextRequest) {
  try {
    const params = Object.fromEntries(request.nextUrl.searchParams);
    const parsed = listTeamMembersQuerySchema.safeParse(params);
    if (!parsed.success) return apiValidationError(parsed.error);

    const result = await getTeamMemberService().list(parsed.data);
    return respond(result);
  } catch (error) {
    return apiUnexpected(error);
  }
}
