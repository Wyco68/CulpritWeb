import type { NextRequest } from 'next/server';
import { getCvEntryService, updateCvEntrySchema } from '@/modules/teaching';
import { requireAdmin } from '@/modules/auth';
import {
  apiError,
  apiUnexpected,
  apiValidationError,
  respond,
} from '@/modules/shared/lib/api-response';
import { revalidateOn } from '@/modules/shared/lib/revalidate';
import { readJsonBody } from '@/modules/shared/lib/request';

// Admin: update a CV entry. See the POST route for why both public areas are purged.
export async function PUT(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return apiError(admin.error);

    const { id } = await ctx.params;
    const parsed = updateCvEntrySchema.safeParse(await readJsonBody(request));
    if (!parsed.success) return apiValidationError(parsed.error);

    const result = await getCvEntryService().update(id, parsed.data, `admin:${admin.data.userId}`);
    return respond(revalidateOn(result, 'teaching', 'about'));
  } catch (error) {
    return apiUnexpected(error);
  }
}

// Admin: delete a CV entry. Audited (full before-state) inside the delete transaction.
export async function DELETE(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return apiError(admin.error);

    const { id } = await ctx.params;
    const result = await getCvEntryService().remove(id, `admin:${admin.data.userId}`);
    return respond(revalidateOn(result, 'teaching', 'about'));
  } catch (error) {
    return apiUnexpected(error);
  }
}
