import { apiSuccess } from '@/modules/shared/lib/api-response';

// Container/load-balancer liveness probe. Deliberately does no DB or external-service work —
// a health check that depends on Postgres/R2/Resend turns a transient dependency blip into a
// false "app is down" and can trigger unwanted container restarts.
export async function GET() {
  return apiSuccess({ status: 'ok' });
}
