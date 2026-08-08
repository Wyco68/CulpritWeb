// integrations module — edges behind interfaces: EmailClient (Resend), TurnstileVerifier
// (Cloudflare), RateLimiter (Upstash), StorageAdapter (Supabase Storage). Each has a real
// adapter + a graceful no-op when its env is unset, so dev/test never crash. No domain logic
// lives here.
//
// Calendly is embed-only — a client widget component, nothing else. There is deliberately no
// server-side Calendly integration of any kind: no PAT, no REST client, no webhook receiver. A
// booking made in the widget happens entirely on Calendly's side (including Calendly's own
// confirmation email to the visitor) and is never recorded locally — see
// modules/appointments for how the admin records an appointment instead. This keeps the
// integration genuinely free: a public embed script needs no paid tier or API token at all.
//
// YouTube is likewise embed-only — a presentational iframe component + ID parsing utility, no
// domain wiring.
//
// EmailClient (Resend) is reserved for admin-facing features (e.g. login-adjacent email), not
// appointments — appointment confirmation/cancellation email is Calendly's own, sent directly to
// the visitor, outside this app.

export { CalendlyEmbed, type CalendlyEmbedProps } from './calendly/calendly-embed';

export {
  type EmailClient,
  type SendEmailInput,
  NoopEmailClient,
  ResendEmailClient,
  getEmailClient,
} from './email/email-client';

export {
  type TurnstileVerifier,
  NoopTurnstileVerifier,
  CloudflareTurnstileVerifier,
  getTurnstileVerifier,
} from './turnstile/turnstile-verifier';
export { TurnstileChallenge, type TurnstileChallengeProps } from './turnstile/turnstile-challenge';

export {
  type RateLimiter,
  type RateLimitResult,
  NoopRateLimiter,
  UpstashRateLimiter,
  getRateLimiter,
} from './rate-limit/rate-limiter';

export { guardPublicWrite, type PublicWriteGuardDeps } from './guard/public-write-guard';

export {
  type StorageAdapter,
  type StorageBucket,
  PUBLIC_STORAGE_BUCKETS,
  NoopStorageAdapter,
  R2StorageAdapter,
  getStorageAdapter,
} from './storage/storage-adapter';

export { YouTubeVideo, type YouTubeVideoProps } from './youtube/youtube-video';
export { parseYouTubeVideoId } from './youtube/youtube-utils';
