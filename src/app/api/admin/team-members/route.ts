import type { NextRequest } from 'next/server';
import { getTeamMemberService, createTeamMemberSchema } from '@/modules/research-groups';
import { requireAdmin } from '@/modules/auth';
import { apiError, apiUnexpected, apiValidationError, respond } from '@/modules/shared/lib/api-response';
import { readJsonBody } from '@/modules/shared/lib/request';

// Admin: create a team member. `researchGroupId` is optional/nullable.
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return apiError(admin.error);

    const parsed = createTeamMemberSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) return apiValidationError(parsed.error);

    const result = await getTeamMemberService().create(parsed.data, `admin:${admin.data.userId}`);
    return respond(result, 201);
  } catch (error) {
    return apiUnexpected(error);
  }
}
