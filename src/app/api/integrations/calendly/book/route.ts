import type { NextRequest } from 'next/server';
import { getCalendlyService } from '@/modules/integrations';
import { requireAdmin } from '@/modules/auth';
import { apiError, apiUnexpected, respond } from '@/modules/shared/lib/api-response';

// Admin: create-booking is NOT available on the Calendly Free plan (no public API). This endpoint
// returns an honest, structured "not supported" payload (200) directing callers to the embed /
// scheduling link. Kept so the contract exists and can be upgraded if a paid plan lands.
export async function POST(_request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return apiError(admin.error);

    const result = await getCalendlyService().createBooking();
    return respond(result);
  } catch (error) {
    return apiUnexpected(error);
  }
}
