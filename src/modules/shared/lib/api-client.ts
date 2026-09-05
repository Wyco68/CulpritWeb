// Browser-side calls into this app's own API. Every route answers with the envelope built in
// `api-response.ts`, so unwrapping it belongs in one place rather than in each admin screen.

/**
 * Structurally the same shape `api-response.ts` builds, declared again rather than imported.
 * That module pulls in `next/server`, and this one is imported by Client Components — the project
 * has been bitten before by imports that were expected to be erased and were not (see the
 * deep-import comments in the admin form dialogs), so the client side keeps its own copy.
 */
type ApiEnvelope<T> = { ok: true; data: T } | { ok: false; error?: { message?: string } };

/**
 * Call an API route and return its payload. A rejected envelope becomes a throw carrying the
 * server's own message, which is what puts it on TanStack Query's error path (and in the toast).
 *
 * Not every response comes from a route handler: the platform rejects an over-sized upload body at
 * the edge before the handler runs (see integrations/storage/uploaded-photo.ts), and a proxy in
 * front of the origin can answer with an HTML error page. Those have no envelope to read, so the
 * body is parsed defensively and the status is the fallback — otherwise the admin would be shown a
 * JSON parser error where a real reason belongs.
 */
export async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);

  let body: ApiEnvelope<T> | undefined;
  try {
    body = (await response.json()) as ApiEnvelope<T>;
  } catch {
    // Not an envelope: an edge-rejected upload, a proxy's HTML error page, or an empty body.
    body = undefined;
  }

  if (!body) throw new Error(`Request failed (${response.status})`);
  if (!body.ok) throw new Error(body.error?.message ?? `Request failed (${response.status})`);
  return body.data;
}

/** `apiRequest` for a JSON body — the shape of every admin create/update/patch. */
export function apiSend<T>(
  method: 'POST' | 'PUT' | 'PATCH',
  url: string,
  payload: unknown,
): Promise<T> {
  return apiRequest<T>(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function apiDelete(url: string): Promise<void> {
  return apiRequest<void>(url, { method: 'DELETE' });
}
