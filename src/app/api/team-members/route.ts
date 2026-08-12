import { getTeamMemberService } from '@/modules/research-groups';
import { apiUnexpected, respondPublicCache } from '@/modules/shared/lib/api-response';

// Public: list ALL team members, ordered by sortOrder. Filtered-by-group reads live at the
// separate `/api/team-members/group/{groupId}` route (see ADR-007's addendum) — splitting them
// keeps this route free of `searchParams`, which is what makes it eligible for the same
// ISR-style route cache as the other public GET API routes.
//
// Old callers on the pre-split `?groupId=` contract still land HERE (Next doesn't route on query
// string). `middleware.ts`'s `resolveTeamMembersCompatRedirect` 307s them to the new path — NOT
// handled here. An earlier version of this route read `request.nextUrl.searchParams` directly in
// this handler to do that redirect; that alone forced the whole route dynamic (confirmed via
// `next build`'s "Dynamic server usage" error), silently defeating the `revalidate` below despite
// this file's own comment claiming otherwise. Moving the redirect to middleware — which isn't
// subject to route-level static analysis — is what actually makes this route cacheable.
export const revalidate = 3600;

export async function GET() {
  try {
    const result = await getTeamMemberService().list();
    return respondPublicCache(result, { browserTtl: 300, edgeTtl: 3600, staleWhileRevalidate: 300 });
  } catch (error) {
    return apiUnexpected(error);
  }
}
