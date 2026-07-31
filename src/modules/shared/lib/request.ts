import { createHash } from 'node:crypto';
import type { NextRequest } from 'next/server';

/**
 * Parse a request body as JSON without letting a malformed body escalate into a 500.
 * A client that sends `Content-Type: application/json` with invalid JSON is a bad *request*,
 * not a server fault — callers should feed the result straight into `schema.safeParse`, which
 * will reject `undefined` as a validation error (400) rather than the route handler throwing.
 */
export async function readJsonBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

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
