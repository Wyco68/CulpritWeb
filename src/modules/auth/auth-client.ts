'use client';

import { createAuthClient } from 'better-auth/react';
import { emailOTPClient, twoFactorClient } from 'better-auth/client/plugins';
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
//
// Plugins (ADR-022): `twoFactor` (emailed sign-in code, backup codes) and `emailOtp` (forgot
// password by emailed code only — the server disables every other email-otp endpoint). No
// `onTwoFactorRedirect`/`twoFactorPage`: the login form reads `twoFactorRedirect` off the
// `signIn.email` result itself and moves to its code step without a page reload.
export const authClient = createAuthClient({
  baseURL: typeof window !== 'undefined' ? window.location.origin : publicEnv.appUrl || undefined,
  plugins: [twoFactorClient(), emailOTPClient()],
});

// Explicit named exports (not a destructuring re-export): Turbopack's client-boundary export
// tracing can't statically resolve `export const { a, b } = obj`, so a Server Component that
// imports this module transitively (via the ./index.ts barrel) silently fails to bind these,
// breaking client hydration on every admin page with no visible error.
export const signIn = authClient.signIn;
export const signOut = authClient.signOut;
export const useSession = authClient.useSession;
/** `sendOtp`, `verifyOtp`, `verifyBackupCode`, `enable`, `disable`, `generateBackupCodes`. */
export const twoFactor = authClient.twoFactor;
/** Only `requestPasswordReset` and `resetPassword` are served; the rest answer 404. */
export const emailOtp = authClient.emailOtp;
