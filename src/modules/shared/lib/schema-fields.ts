import { z } from 'zod';
import { stripHtml } from './sanitize';

// The field vocabulary every module's Zod schema is built from. Sanitize first, then validate the
// sanitized value — `stripHtml` can empty a string, so a length check applied before it would pass
// input that ends up stored as ''.

/** Required free text: trimmed, HTML stripped, then length-bounded on what actually gets stored. */
export const safeText = (max: number) =>
  z.string().trim().transform(stripHtml).pipe(z.string().min(1).max(max));

/**
 * Optional free text that clears its column when emptied. Nullable as well as optional: an
 * undefined key vanishes from the JSON body, which the update routes read as "leave the column
 * alone", so an emptied field has to arrive as an explicit null.
 */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => stripHtml(value) || null)
    .nullable()
    .optional();

/**
 * `z.string().url()` alone is not enough here. It delegates to the URL parser, which accepts ANY
 * scheme — `javascript:alert(1)` and `data:text/html,...` both pass it. Every URL below is
 * rendered straight into an `href` or `src` on the public site (publications-list, research-list,
 * profile-links, the Calendly embed), so a stored `javascript:` URL would be a live XSS vector the
 * moment a visitor clicked it. Restricting the scheme at the boundary is what closes that.
 */
function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

const URL_MESSAGE = 'Must be a valid URL.';

/** A required http(s) URL — e.g. a photo URL handed back by an upload route. */
export const httpUrl = z.string().trim().max(2000).refine(isHttpUrl, { message: URL_MESSAGE });

/** An optional external link. An empty string from an untouched form input means "unset". */
export const optionalUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((value) => value === '' || isHttpUrl(value), { message: URL_MESSAGE })
  .transform((value) => value || null)
  .nullable()
  .optional();

/** A record id arriving as a path param, re-validated at the boundary. */
export const entityId = z.string().trim().min(1).max(200);

/** The admin's manual ordering position. */
export const sortOrder = z.coerce.number().int().min(0).max(100_000).optional();
