import { logger } from './logger';

const PURGE_TIMEOUT_MS = 5000;

/**
 * Best-effort Cloudflare edge purge for the given site-relative paths. Optional infra, same
 * pattern as every other third-party integration in this codebase (Resend, R2, Turnstile): no-ops
 * entirely when `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ZONE_ID` aren't configured, so a deploy that
 * hasn't set them up yet behaves exactly as before this existed — Next's own `revalidatePath` (see
 * `./revalidate`) still runs regardless, so the origin is always correct; this only trims how long
 * a stale response can keep being served from Cloudflare's edge on top of that.
 *
 * Never throws. A purge failure must not fail the admin mutation that triggered it (see
 * `revalidatePublic`'s use via `next/server`'s `after()`, which already runs after the response is
 * sent) — the database write stays authoritative, and the route's `revalidate` TTL is the fallback
 * bound if a purge silently no-ops.
 */
export async function purgeCloudflareCache(paths: string[]): Promise<void> {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!token || !zoneId || !appUrl || paths.length === 0) return;

  const files = paths.map((path) => new URL(path, appUrl).toString());
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ files }),
        signal: AbortSignal.timeout(PURGE_TIMEOUT_MS),
      },
    );
    const body: { success?: boolean; errors?: unknown } | null = await response
      .json()
      .catch(() => null);
    if (!response.ok || !body?.success) {
      logger.error('cloudflare_purge_failed', {
        status: response.status,
        errors: body?.errors,
        files,
      });
    }
  } catch (error) {
    logger.error('cloudflare_purge_failed', {
      files,
      causeMessage: error instanceof Error ? error.message : String(error),
    });
  }
}
