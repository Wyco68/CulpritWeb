// Free-text sanitization applied AFTER Zod validation (Zod checks shape, not safety).
// Default policy for this project is PLAIN TEXT only: strip anything that looks like markup so
// nothing renderable (bio/topic/group/reason) can carry HTML/script into a React view.

const TAG_RE = /<[^>]*>/g;
// C0 control chars except tab/newline/CR, plus DEL.
const CONTROL_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

/** Remove HTML tags and control chars, collapse whitespace, and trim. */
export function stripHtml(input: string): string {
  return input
    .replace(TAG_RE, '')
    .replace(CONTROL_RE, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
}
