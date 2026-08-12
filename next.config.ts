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
};

export default nextConfig;
