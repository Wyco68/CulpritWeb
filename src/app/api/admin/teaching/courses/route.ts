import type { NextRequest } from 'next/server';
import { getCourseService, createCourseSchema } from '@/modules/teaching';
import { requireAdmin } from '@/modules/auth';
import { apiError, apiUnexpected, apiValidationError, respond } from '@/modules/shared/lib/api-response';
import { revalidateOn } from '@/modules/shared/lib/revalidate';
import { readJsonBody } from '@/modules/shared/lib/request';

// Admin: create a course.
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return apiError(admin.error);

    const parsed = createCourseSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) return apiValidationError(parsed.error);

    const result = await getCourseService().create(parsed.data, `admin:${admin.data.userId}`);
    return respond(revalidateOn(result, 'teaching'), 201);
  } catch (error) {
    return apiUnexpected(error);
  }
}
