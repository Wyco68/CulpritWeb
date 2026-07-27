import { headers } from 'next/headers';
import { UnauthorizedError } from '@/modules/shared/lib/errors';
import { err, ok, type Result } from '@/modules/shared/lib/result';
import { auth } from './auth';

export type AdminSession = {
  userId: string;
  email: string;
};

/**
 * Authoritative admin gate re-checked at every admin route handler / server action (middleware is
 * only a convenience redirect). Returns 401 via UnauthorizedError when there is no valid session.
 * Reads session state from the DB so a revoked session takes effect immediately.
 *
 * Single-admin MVP: any authenticated Better Auth user is the admin. When a second role lands,
 * add a `role === 'admin'` check here — additive, no call-site changes.
 */
export async function requireAdmin(): Promise<Result<AdminSession, UnauthorizedError>> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return err(new UnauthorizedError());
  return ok({ userId: session.user.id, email: session.user.email });
}
