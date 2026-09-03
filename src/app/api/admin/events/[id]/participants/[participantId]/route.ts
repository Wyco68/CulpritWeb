import type { NextRequest } from 'next/server';
import { getEventService, participantIdSchema } from '@/modules/events';
import { requireAdmin } from '@/modules/auth';
import {
  apiError,
  apiUnexpected,
  apiValidationError,
  respond,
} from '@/modules/shared/lib/api-response';
import { revalidateOn } from '@/modules/shared/lib/revalidate';

// Admin: remove one participant from an event. Both ids are re-validated here even though they
// arrive as path params, and the repository scopes the delete by event as well as participant, so
// an id belonging to another event cannot reach this row.
export async function DELETE(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string; participantId: string }> },
) {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return apiError(admin.error);

    const { id, participantId } = await ctx.params;
    const parsed = participantIdSchema.safeParse(participantId);
    if (!parsed.success) return apiValidationError(parsed.error);

    const result = await getEventService().removeParticipant(
      id,
      parsed.data,
      `admin:${admin.data.userId}`,
    );
    return respond(revalidateOn(result, 'events'));
  } catch (error) {
    return apiUnexpected(error);
  }
}
