import type { NextRequest } from 'next/server';
import { getCalendlyService } from '@/modules/integrations';
import { requireAdmin } from '@/modules/auth';
import { apiError, apiUnexpected, respond } from '@/modules/shared/lib/api-response';

// Admin: list the professor's Calendly event types.
export async function GET(_request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return apiError(admin.error);

    const result = await getCalendlyService().getEventTypes();
    return respond(result);
  } catch (error) {
    return apiUnexpected(error);
  }
}
