import type { NextRequest } from 'next/server';
import { getCalendlyService, cancelEventSchema } from '@/modules/integrations';
import { requireAdmin } from '@/modules/auth';
import { apiError, apiUnexpected, apiValidationError, respond } from '@/modules/shared/lib/api-response';

// Admin: cancel a scheduled Calendly event (supported on the Free plan).
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return apiError(admin.error);

    const parsed = cancelEventSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return apiValidationError(parsed.error);

    const result = await getCalendlyService().cancelEvent(parsed.data.eventUri, parsed.data.reason);
    return respond(result);
  } catch (error) {
    return apiUnexpected(error);
  }
}
