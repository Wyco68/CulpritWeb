import {
  AppError,
  IntegrationError,
  NotFoundError,
  RateLimitError,
  UnauthorizedError,
} from '@/modules/shared/lib/errors';
import { logger } from '@/modules/shared/lib/logger';

// Thin HTTP client for the Calendly REST API (https://api.calendly.com). It injects the bearer
// token, centralizes fetch + error mapping, and NEVER leaks the token or upstream stack traces —
// callers receive typed AppErrors with safe messages only.

const BASE_URL = 'https://api.calendly.com';

export interface CalendlyRequestOptions {
  method?: 'GET' | 'POST';
  /** Query params for GET requests. Nullish values are dropped. */
  query?: Record<string, string | number | undefined | null>;
  /** JSON body for POST requests. */
  body?: unknown;
}

export interface CalendlyClient {
  request<T>(path: string, options?: CalendlyRequestOptions): Promise<T>;
}

function buildUrl(path: string, query?: CalendlyRequestOptions['query']): string {
  // Allow absolute Calendly URIs (e.g. an event uri) or relative paths.
  const url = new URL(path.startsWith('http') ? path : `${BASE_URL}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

/** Map an HTTP status to a typed AppError with a SAFE (non-leaking) message. */
function mapStatus(status: number, retryAfterHeader: string | null): AppError {
  switch (status) {
    case 401:
      return new UnauthorizedError('Calendly access token is invalid or expired.');
    case 403:
      return new IntegrationError('Calendly denied the request (insufficient permissions or plan).');
    case 404:
      return new NotFoundError('The requested Calendly resource was not found.');
    case 429: {
      const retryAfter = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : undefined;
      return new RateLimitError(
        'Calendly rate limit reached. Please retry shortly.',
        Number.isFinite(retryAfter) ? retryAfter : undefined,
      );
    }
    default:
      return new IntegrationError('Calendly is currently unavailable.');
  }
}

export class HttpCalendlyClient implements CalendlyClient {
  constructor(
    private readonly accessToken: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async request<T>(path: string, options: CalendlyRequestOptions = {}): Promise<T> {
    const url = buildUrl(path, options.query);
    const method = options.method ?? 'GET';

    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      });
    } catch (cause) {
      // Network / DNS / abort. Log detail server-side, surface a safe error.
      logger.error('calendly_network_error', { method, code: 'network' });
      void cause;
      throw new IntegrationError('Could not reach Calendly.');
    }

    if (!res.ok) {
      logger.warn('calendly_http_error', { method, status: res.status });
      throw mapStatus(res.status, res.headers.get('retry-after'));
    }

    if (res.status === 204) return undefined as T;

    try {
      return (await res.json()) as T;
    } catch (cause) {
      logger.error('calendly_parse_error', { method });
      void cause;
      throw new IntegrationError('Received an unreadable response from Calendly.');
    }
  }
}
