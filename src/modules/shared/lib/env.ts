// CLIENT-SAFE env. Only NEXT_PUBLIC_* values live here — they are inlined into the browser bundle
// by Next, so nothing secret may ever be read in this file. Server secrets live in `env.server.ts`
// (guarded by `server-only`). This module is safe to import from client components (e.g. the
// Calendly embed) and from server code alike.
export const publicEnv = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? '',
  turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '',
  calendlyUrl: process.env.NEXT_PUBLIC_CALENDLY_URL ?? '',
};
