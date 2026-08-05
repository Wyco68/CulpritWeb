import type { NextRequest } from 'next/server';
import { getResearchService, updateResearchSchema } from '@/modules/research';
import { requireAdmin } from '@/modules/auth';
import { apiError, apiUnexpected, apiValidationError, respond } from '@/modules/shared/lib/api-response';
import { readJsonBody } from '@/modules/shared/lib/request';

// Admin: update a research work.
export async function PUT(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return apiError(admin.error);

    const { id } = await ctx.params;
    const parsed = updateResearchSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) return apiValidationError(parsed.error);

    const result = await getResearchService().update(id, parsed.data, `admin:${admin.data.userId}`);
    return respond(result);
  } catch (error) {
    return apiUnexpected(error);
  }
}

// Admin: delete a research work.
export async function DELETE(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return apiError(admin.error);

    const { id } = await ctx.params;
    const result = await getResearchService().remove(id, `admin:${admin.data.userId}`);
    return respond(result);
  } catch (error) {
    return apiUnexpected(error);
  }
}
