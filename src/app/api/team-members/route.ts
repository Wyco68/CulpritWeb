import { NextResponse, type NextRequest } from 'next/server';
import { getTeamMemberService } from '@/modules/research-groups';
import { apiUnexpected, respond } from '@/modules/shared/lib/api-response';

// Public: list ALL team members, ordered by sortOrder. Filtered-by-group reads live at the
// separate `/api/team-members/group/{groupId}` route (see ADR-007's addendum) — splitting them
// keeps this route free of `searchParams`, which is what makes it eligible for the same
// ISR-style route cache as the other public GET API routes.
//
// Old callers on the pre-split `?groupId=` contract still land HERE (Next doesn't route on query
// string). Redirect them to the new path instead of silently returning the unfiltered list —
// wrong-by-silence is worse than a 307. This check reads `nextUrl.searchParams` only on this one
// branch; the common no-query-string request never touches it, so the route stays cacheable.
export const revalidate = 3600;

export async function GET(request: NextRequest) {
  try {
    const groupId = request.nextUrl.searchParams.get('groupId');
    if (groupId) {
      return NextResponse.redirect(
        new URL(`/api/team-members/group/${encodeURIComponent(groupId)}`, request.url),
        307,
      );
    }

    const result = await getTeamMemberService().list();
    return respond(result);
  } catch (error) {
    return apiUnexpected(error);
  }
}
