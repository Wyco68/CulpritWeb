import type { NextRequest } from 'next/server';
import { getResearchService, updateResearchSchema } from '@/modules/research';
import { requireAdmin } from '@/modules/auth';
import {
  apiError,
  apiUnexpected,
  apiValidationError,
  respond,
} from '@/modules/shared/lib/api-response';
import { entityId } from '@/modules/shared/lib/schema-fields';
import { revalidateOn } from '@/modules/shared/lib/revalidate';
import { readJsonBody } from '@/modules/shared/lib/request';

export async function PUT(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return apiError(admin.error);

    const { id } = await ctx.params;
    const parsedId = entityId.safeParse(id);
    if (!parsedId.success) return apiValidationError(parsedId.error);

    const parsed = updateResearchSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) return apiValidationError(parsed.error);

    const result = await getResearchService().update(
      parsedId.data,
      parsed.data,
      `admin:${admin.data.userId}`,
    );
    return respond(revalidateOn(result, 'research'));
  } catch (error) {
    return apiUnexpected(error);
  }
}

export async function DELETE(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return apiError(admin.error);

    const { id } = await ctx.params;
    const parsedId = entityId.safeParse(id);
    if (!parsedId.success) return apiValidationError(parsedId.error);

    const result = await getResearchService().remove(parsedId.data, `admin:${admin.data.userId}`);
    return respond(revalidateOn(result, 'research'));
  } catch (error) {
    return apiUnexpected(error);
  }
}
