import type { NextRequest } from 'next/server';
import { getTeamMemberService, teamMemberGroupIdSchema } from '@/modules/research-groups';
import { apiUnexpected, apiValidationError, respondPublicCache } from '@/modules/shared/lib/api-response';

// Public: list team members belonging to one research group, ordered by sortOrder. Split out of
// the unfiltered `/api/team-members` route (see ADR-007's addendum) because a `[groupId]` path
// segment, unlike a `?groupId=` search param, does not force the route dynamic — Next can still
// generate/cache each resolved group path via the same ISR mechanism as the other public GET API
// routes. An unmatched/nonexistent groupId returns `200 { ok: true, data: [] }` (the repository
// only filters; it never checks the group exists), matching the old query-string route's behavior.
export const revalidate = 3600;

export async function GET(_request: NextRequest, ctx: { params: Promise<{ groupId: string }> }) {
  try {
    const { groupId } = await ctx.params;
    const parsed = teamMemberGroupIdSchema.safeParse(groupId);
    if (!parsed.success) return apiValidationError(parsed.error);

    const result = await getTeamMemberService().list({ groupId: parsed.data });
    return respondPublicCache(result, { browserTtl: 300, edgeTtl: 3600, staleWhileRevalidate: 300 });
  } catch (error) {
    return apiUnexpected(error);
  }
}
