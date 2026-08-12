import type { NextConfig } from 'next';

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
  // Photos (profile/team) come from Supabase Storage — the adopted object store per
  // PROJECT_SPEC.md §14.1 (Cloudflare R2 was Option B, evaluated and rejected). Left empty: the
  // `Avatar` component renders a plain `<img>`, not `next/image` (see its own comment for why),
  // so this allow-list currently has no consumer. Add the Supabase project host here first if
  // that ever changes.
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
