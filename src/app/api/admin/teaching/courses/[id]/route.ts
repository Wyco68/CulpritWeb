import type { NextRequest } from 'next/server';
import { getCourseService, updateCourseSchema } from '@/modules/teaching';
import { requireAdmin } from '@/modules/auth';
import {
  apiError,
  apiUnexpected,
  apiValidationError,
  respond,
} from '@/modules/shared/lib/api-response';
import { revalidateOn } from '@/modules/shared/lib/revalidate';
import { readJsonBody } from '@/modules/shared/lib/request';

export async function PUT(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return apiError(admin.error);

    const { id } = await ctx.params;
    const parsed = updateCourseSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) return apiValidationError(parsed.error);

    const result = await getCourseService().update(id, parsed.data, `admin:${admin.data.userId}`);
    return respond(revalidateOn(result, 'teaching'));
  } catch (error) {
    return apiUnexpected(error);
  }
}

// Admin: delete a course. Audited (full before-state) inside the delete transaction.
export async function DELETE(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return apiError(admin.error);

    const { id } = await ctx.params;
    const result = await getCourseService().remove(id, `admin:${admin.data.userId}`);
    return respond(revalidateOn(result, 'teaching'));
  } catch (error) {
    return apiUnexpected(error);
  }
}
