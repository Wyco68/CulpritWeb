import type { NextRequest } from 'next/server';
import { getEventService, updateEventSchema } from '@/modules/events';
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
    const parsed = updateEventSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) return apiValidationError(parsed.error);

    const result = await getEventService().update(id, parsed.data, `admin:${admin.data.userId}`);
    return respond(revalidateOn(result, 'events'));
  } catch (error) {
    return apiUnexpected(error);
  }
}

// Admin: delete an event. Unlike the appointment lifecycle this replaced, there is no soft-cancel
// state to fall back to — an event is either published or gone — so this is the only removal path.
// The service writes the full before-state to the AuditLog inside the delete transaction.
export async function DELETE(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return apiError(admin.error);

    const { id } = await ctx.params;
    const result = await getEventService().remove(id, `admin:${admin.data.userId}`);
    return respond(revalidateOn(result, 'events'));
  } catch (error) {
    return apiUnexpected(error);
  }
}
