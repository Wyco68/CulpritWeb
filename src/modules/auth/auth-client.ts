'use client';

import { createAuthClient } from 'better-auth/react';
import { publicEnv } from '@/modules/shared/lib/env';

// Better Auth's React client — cookie-session aware (`credentials: 'include'` by default), talks
// to the server handler mounted at `/api/auth/[...all]`.
//
// In the browser it calls the origin the page was served from, not NEXT_PUBLIC_APP_URL: one
// Doppler config serves local, staging and production, so that variable names a single host, and a
// page on any other host (localhost, the production domain) would post its sign-in cross-origin —
// which the CSP's `connect-src 'self'` blocks outright. Same-origin works in every environment.
// During server rendering there is no window; the configured URL is only a placeholder there,
// since nothing signs in during SSR.
export const authClient = createAuthClient({
  baseURL: typeof window !== 'undefined' ? window.location.origin : publicEnv.appUrl || undefined,
});

// Explicit named exports (not a destructuring re-export): Turbopack's client-boundary export
// tracing can't statically resolve `export const { a, b } = obj`, so a Server Component that
// imports this module transitively (via the ./index.ts barrel) silently fails to bind these,
// breaking client hydration on every admin page with no visible error.
export const signIn = authClient.signIn;
export const signOut = authClient.signOut;
export const useSession = authClient.useSession;
