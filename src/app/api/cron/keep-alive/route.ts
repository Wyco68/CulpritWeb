import { timingSafeEqual } from 'node:crypto';
import { getProfileService } from '@/modules/profile';
import { apiError, apiSuccess, apiUnexpected } from '@/modules/shared/lib/api-response';
import { UnauthorizedError } from '@/modules/shared/lib/errors';
import { env } from '@/modules/shared/lib/env.server';

// Supabase keep-alive, called once a day by Vercel Cron (vercel.json) on the production
// deployment. Supabase pauses a Free project after a week without database activity, and public
// pages are prerendered, so a quiet week would otherwise reach that limit (ADR-024). The 6-hourly
// Neon sync workflow already reads Supabase; this is the second, independent signal, so the
// database stays awake even if GitHub disables that scheduled workflow.
//
// Unlike /api/health, this route does hit the database — that is its whole job. It reads the
// lab profile (a real table, not `SELECT 1`) and returns nothing from it.
//
// Vercel sends `Authorization: Bearer $CRON_SECRET` on cron requests. Without CRON_SECRET set,
// every request is refused, so the route is inert anywhere the cron isn't configured.
export const dynamic = 'force-dynamic';
// One small read takes well under a second; the cap stops a hung connection from billing minutes
// of function time.
export const maxDuration = 10;

function isCronRequest(authorization: string | null): boolean {
  const secret = env.CRON_SECRET;
  if (!secret || !authorization) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(authorization);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function GET(request: Request) {
  if (!isCronRequest(request.headers.get('authorization'))) {
    return apiError(new UnauthorizedError());
  }
  try {
    const result = await getProfileService().getProfile();
    if (!result.ok) return apiError(result.error);
    return apiSuccess({ status: 'ok' });
  } catch (error) {
    return apiUnexpected(error);
  }
}
