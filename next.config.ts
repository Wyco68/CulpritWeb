import type { NextConfig } from 'next';

// Best-effort host derivation for next/image's allow-list. R2_PUBLIC_URL may be unset for a
// contributor who hasn't configured R2 yet, or a CI step that doesn't need it — fall back to no
// allow-listed host rather than crashing config eval.
function r2RemotePatterns(): NonNullable<NextConfig['images']>['remotePatterns'] {
  const publicUrl = process.env.R2_PUBLIC_URL;
  if (!publicUrl) return [];
  try {
    const { protocol, hostname } = new URL(publicUrl);
    if (protocol !== 'http:' && protocol !== 'https:') {
      console.warn(`R2_PUBLIC_URL has unsupported protocol "${protocol}" — ignoring.`);
      return [];
    }
    return [{ protocol: protocol.slice(0, -1) as 'http' | 'https', hostname }];
  } catch {
    console.warn(`R2_PUBLIC_URL "${publicUrl}" is not a valid URL — ignoring.`);
    return [];
  }
}

// The public R2 host, if configured, needs to appear in img-src alongside the app's own origin —
// same derivation as r2RemotePatterns() above, kept separate since CSP wants a bare host string.
function r2ImgSrc(): string {
  const publicUrl = process.env.R2_PUBLIC_URL;
  if (!publicUrl) return '';
  try {
    return new URL(publicUrl).origin;
  } catch {
    return '';
  }
}

// Third-party embeds are the only reason this isn't a same-origin-only policy: the Calendly widget
// (script + iframe, see calendly-embed.tsx), the Turnstile challenge (script + iframe, see
// turnstile-challenge.tsx), and the YouTube players on the Events tab (iframe only — the embed is
// a plain <iframe src>, so youtube-nocookie.com needs frame-src but not script-src). No inline <script> is used anywhere in the app (grepped — every script
// is an external chunk or a next/script src=), so script-src omits 'unsafe-inline' entirely. style-src
// keeps it: React inline `style={{...}}` attributes (dynamic widths/heights) are used across the UI
// and CSP has no practical hash/nonce story for those.
function buildCsp(): string {
  const r2Origin = r2ImgSrc();
  // Next.js dev mode (Fast Refresh / HMR) both eval()-wraps modules and injects the hot-update
  // runtime as dynamically-created inline <script> elements — needs 'unsafe-eval' and
  // 'unsafe-inline' script-src or dev breaks entirely (confirmed by running it: without these two,
  // every HMR update throws a CSP violation in the browser console). The production build emits
  // real external chunk files instead of either, so neither exception reaches the policy actually
  // served in prod — verified separately against a prod build before shipping this.
  const isDev = process.env.NODE_ENV !== 'production';
  const directives: Record<string, string[]> = {
    'default-src': [`'self'`],
    'script-src': [
      `'self'`,
      'https://assets.calendly.com',
      'https://challenges.cloudflare.com',
      ...(isDev ? [`'unsafe-eval'`, `'unsafe-inline'`] : []),
    ],
    'style-src': [`'self'`, `'unsafe-inline'`],
    'img-src': [`'self'`, 'data:', ...(r2Origin ? [r2Origin] : [])],
    'font-src': [`'self'`, 'data:'],
    'connect-src': [`'self'`, 'https://calendly.com', 'https://*.calendly.com', 'https://challenges.cloudflare.com'],
    'frame-src': [
      'https://calendly.com',
      'https://*.calendly.com',
      'https://challenges.cloudflare.com',
      'https://www.youtube-nocookie.com',
    ],
    'object-src': [`'none'`],
    'base-uri': [`'self'`],
    'form-action': [`'self'`],
    'frame-ancestors': [`'none'`],
  };
  return Object.entries(directives)
    .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
    .join('; ');
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Self-contained server bundle (server.js + pruned prod-only node_modules) — the production
  // Docker image copies only .next/standalone instead of the full node_modules tree. Irrelevant to
  // the existing Vercel deploy (Vercel ignores `output` and always uses its own build output).
  output: 'standalone',
  experimental: {
    // Client-side Router Cache lifetimes. Next's default for dynamic segments is 0, so clicking
    // back to a tab you were just on re-fetches its whole RSC payload — a full server round trip
    // (and, in dev, a DB query to the remote Supabase region) for content that has not changed.
    // The public/admin tab bars are exactly this back-and-forth pattern, so hold prefetched and
    // visited payloads briefly: re-selecting a tab within the window renders from memory.
    staleTimes: { dynamic: 30 },
  },
  // Photos (profile/team) come from Cloudflare R2 — object storage moved off Supabase Storage on
  // 2026-08-08 (see docs/decisions/ADR-002-object-storage-r2.md). The public R2 host is derived
  // from R2_PUBLIC_URL at config-eval time so the `Avatar` component's next/image usage resolves
  // instead of 404ing.
  images: {
    remotePatterns: r2RemotePatterns(),
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Content-Security-Policy', value: buildCsp() },
        ],
      },
    ];
  },
};

export default nextConfig;
