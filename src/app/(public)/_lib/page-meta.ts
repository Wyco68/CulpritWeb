// Turns an admin-written page intro into a `<meta name="description">`.
//
// Every public tab now takes its standfirst from an editable `profile` column, and the same prose
// is the best description a search result could carry — it is the professor's own framing of the
// page, not a developer's guess. But an intro is written to be read on the page and can run to a
// paragraph, while Google renders roughly the first 155-160 characters of a description and drops
// the rest mid-word. So: use the intro when there is one, clipped at a word boundary; otherwise
// fall back to the string the page shipped with, so nothing regresses on a tab the admin has not
// touched.

/** Where search engines stop rendering. Below the usual 160 to leave room for the title suffix. */
const MAX_LENGTH = 155;

/** Don't clip so aggressively that the sentence loses its subject; pad out instead. */
const MIN_WORD_BOUNDARY = 90;

export function toMetaDescription(intro: string | null | undefined, fallback: string): string {
  // Intros are stored as plain text (HTML is stripped at the schema boundary) but may carry the
  // paragraph breaks the admin typed. A description is a single line.
  const text = intro?.replace(/\s+/g, ' ').trim();
  if (!text) return fallback;
  if (text.length <= MAX_LENGTH) return text;

  const clipped = text.slice(0, MAX_LENGTH);
  const lastSpace = clipped.lastIndexOf(' ');
  const truncated = lastSpace >= MIN_WORD_BOUNDARY ? clipped.slice(0, lastSpace) : clipped;

  // Trailing punctuation before an ellipsis reads as a typo. `…` is the real character, matching
  // the rest of the site's typography — never three periods.
  return `${truncated.replace(/[\s.,;:!?—–-]+$/, '')}…`;
}
