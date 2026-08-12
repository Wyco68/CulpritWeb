import { publicEnv } from './env';

// Canonical site URL for metadata (layout.tsx), robots.ts, and sitemap.ts. Falls back to the real
// production domain when NEXT_PUBLIC_APP_URL isn't set for a given environment (e.g. .env.example
// still ships a stale Vercel placeholder that was never filled in — see ADR-009, Vercel was
// dropped for a self-hosted VPS), so a misconfigured deploy still emits a resolvable canonical URL
// instead of an empty string.
export const SITE_URL = publicEnv.appUrl || 'https://culprit.wyco-dev.com';
