import type { NextRequest } from 'next/server';
import { getTeamMemberService, listTeamMembersQuerySchema } from '@/modules/research-groups';
import { apiUnexpected, apiValidationError, respond } from '@/modules/shared/lib/api-response';

// Public: list team members, ordered by sortOrder. Optional `?groupId=` filter.
// NOT cached: reading `request.nextUrl.searchParams` forces this route dynamic (confirmed via
// `next build` — "Dynamic server usage: ... used `nextUrl.searchParams`"), so no `export const
// revalidate` here. Every request hits the DB. `revalidatePath('/api/team-members')` in
// modules/shared/lib/revalidate stays a harmless no-op purge target (correct if this route is
// ever restructured to only read searchParams conditionally and becomes cacheable again).
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
