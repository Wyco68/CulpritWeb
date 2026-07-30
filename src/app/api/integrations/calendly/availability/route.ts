import type { NextRequest } from 'next/server';
import { getCalendlyService, availabilityQuerySchema } from '@/modules/integrations';
import { requireAdmin } from '@/modules/auth';
import { apiError, apiUnexpected, apiValidationError, respond } from '@/modules/shared/lib/api-response';

// Admin: available times for an event type within a window. (Kept admin-only for now; a future
// public booking UI can add its own guarded, rate-limited entry point.)
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return apiError(admin.error);

    const parsed = availabilityQuerySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams),
    );
    if (!parsed.success) return apiValidationError(parsed.error);

    const result = await getCalendlyService().getAvailability(parsed.data);
    return respond(result);
  } catch (error) {
    return apiUnexpected(error);
  }
}
