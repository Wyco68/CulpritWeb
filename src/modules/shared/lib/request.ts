import { createHash } from 'node:crypto';

/** Best-effort client IP from proxy headers. Never trust for auth — used only for rate-limit keys. */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();
  return headers.get('x-real-ip')?.trim() ?? 'unknown';
}

/** One-way hash so raw IPs never land in logs or the audit table (privacy by design). */
export function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex').slice(0, 16);
}
