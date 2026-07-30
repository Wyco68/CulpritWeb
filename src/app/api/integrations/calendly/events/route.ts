import type { NextRequest } from 'next/server';
import { getCalendlyService, listScheduledEventsQuerySchema } from '@/modules/integrations';
import { requireAdmin } from '@/modules/auth';
import { apiError, apiUnexpected, apiValidationError, respond } from '@/modules/shared/lib/api-response';

// Admin: list scheduled Calendly events (optionally filtered by status / time window).
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return apiError(admin.error);

    const parsed = listScheduledEventsQuerySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams),
    );
    if (!parsed.success) return apiValidationError(parsed.error);

    const result = await getCalendlyService().getScheduledEvents(parsed.data);
    return respond(result);
  } catch (error) {
    return apiUnexpected(error);
  }
}
