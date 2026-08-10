'use client';

import { createAuthClient } from 'better-auth/react';
import { publicEnv } from '@/modules/shared/lib/env';

// Better Auth's React client — cookie-session aware (`credentials: 'include'` by default), talks
// to the server handler mounted at `/api/auth/[...all]`. Pointed at the app's own origin so it
// works identically in every environment without a separate "API base URL" to configure.
export const authClient = createAuthClient({
  baseURL: publicEnv.appUrl || undefined,
});

// Explicit named exports (not a destructuring re-export): Turbopack's client-boundary export
// tracing can't statically resolve `export const { a, b } = obj`, so a Server Component that
// imports this module transitively (via the ./index.ts barrel) silently fails to bind these,
// breaking client hydration on every admin page with no visible error.
export const signIn = authClient.signIn;
export const signOut = authClient.signOut;
export const useSession = authClient.useSession;
