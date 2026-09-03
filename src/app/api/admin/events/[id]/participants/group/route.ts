import type { NextRequest } from 'next/server';
import { addGroupParticipantsSchema, getEventService } from '@/modules/events';
import { requireAdmin } from '@/modules/auth';
import {
  apiError,
  apiUnexpected,
  apiValidationError,
  respond,
} from '@/modules/shared/lib/api-response';
import { revalidateOn } from '@/modules/shared/lib/revalidate';
import { readJsonBody } from '@/modules/shared/lib/request';

// Admin: add every member of a research group to an event in one action. The service expands the
// group into individual participant rows, so the event keeps a record of the people who were on it
// at this moment rather than a live reference that later group edits would rewrite.
//
// Members already on the event are skipped, not rejected — running this again after the group
// grows adds only the newcomers. The response reports `added` and `skipped` so the admin sees
// which happened.
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return apiError(admin.error);

    const { id } = await ctx.params;
    const parsed = addGroupParticipantsSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) return apiValidationError(parsed.error);

    const result = await getEventService().addGroupParticipants(
      id,
      parsed.data,
      `admin:${admin.data.userId}`,
    );
    return respond(revalidateOn(result, 'events'));
  } catch (error) {
    return apiUnexpected(error);
  }
}
