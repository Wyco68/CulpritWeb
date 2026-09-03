import type { NextRequest } from 'next/server';
import { addParticipantSchema, getEventService } from '@/modules/events';
import { requireAdmin } from '@/modules/auth';
import {
  apiError,
  apiUnexpected,
  apiValidationError,
  respond,
} from '@/modules/shared/lib/api-response';
import { revalidateOn } from '@/modules/shared/lib/revalidate';
import { readJsonBody } from '@/modules/shared/lib/request';

// Admin: add one participant to an event — a team member, identified by id and snapshotted
// server-side, or a free-text guest. Which of the two is decided by the body's `kind`, validated
// as a discriminated union so the branches cannot be mixed.
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return apiError(admin.error);

    const { id } = await ctx.params;
    const parsed = addParticipantSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) return apiValidationError(parsed.error);

    const result = await getEventService().addParticipant(
      id,
      parsed.data,
      `admin:${admin.data.userId}`,
    );
    return respond(revalidateOn(result, 'events'));
  } catch (error) {
    return apiUnexpected(error);
  }
}
