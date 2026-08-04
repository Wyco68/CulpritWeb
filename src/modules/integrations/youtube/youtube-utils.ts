// YouTube is the project's sole video host. This utility only parses/validates a video ID from
// a bare ID or a full YouTube URL — no network calls, no domain logic. Pure edge helper, mirrors
// the parsing-only style of the Calendly embed helpers.

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

// Hostnames YouTube actually serves watch/embed/short pages from, once `www.`/`m.` is stripped.
const ALLOWED_HOSTS = new Set(['youtube.com', 'youtube-nocookie.com', 'youtu.be']);

/**
 * Extracts and validates a YouTube video ID from either a bare 11-character ID or a full YouTube
 * URL (`youtube.com/watch?v=`, `youtu.be/`, `youtube.com/embed/`, `youtube.com/shorts/`, or the
 * `youtube-nocookie.com` privacy-enhanced domain). Returns `null` — never throws — for anything
 * that doesn't resolve to a well-formed video ID.
 */
export function parseYouTubeVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (VIDEO_ID_PATTERN.test(trimmed)) return trimmed;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^(www\.|m\.)/, '');
  if (!ALLOWED_HOSTS.has(host)) return null;

  let candidate: string | null = null;
  if (host === 'youtu.be') {
    candidate = url.pathname.slice(1).split('/')[0] ?? null;
  } else if (url.pathname === '/watch') {
    candidate = url.searchParams.get('v');
  } else if (url.pathname.startsWith('/embed/')) {
    candidate = url.pathname.slice('/embed/'.length).split('/')[0] ?? null;
  } else if (url.pathname.startsWith('/shorts/')) {
    candidate = url.pathname.slice('/shorts/'.length).split('/')[0] ?? null;
  }

  if (!candidate || !VIDEO_ID_PATTERN.test(candidate)) return null;
  return candidate;
}
