// integrations module — edges behind interfaces: EmailClient (Resend), TurnstileVerifier
// (Cloudflare), RateLimiter (in-process, defense-in-depth behind the Cloudflare edge WAF rate
// limit — see ADR-008), StorageAdapter (Supabase Storage). Each has a real
// adapter + a graceful no-op when its env is unset, so dev/test never crash. No domain logic
// lives here.
//
// Calendly is embed-only — a client widget component, nothing else. There is deliberately no
// server-side Calendly integration of any kind: no PAT, no REST client, no webhook receiver. A
// booking made in the widget happens entirely on Calendly's side (including Calendly's own
// confirmation email to the visitor) and is never recorded locally — there is no admin-side
// appointment screen at all since 2026-09-01, so a meeting worth publishing is written up as an
// event instead (see modules/events). This keeps the integration genuinely free: a public embed
// script needs no paid tier or API token at all.
//
// YouTube is likewise embed-only — a presentational iframe component + ID parsing utility, no
// domain wiring. It is what the Events tab plays its videos through: an event stores a parsed
// video ID, never an uploaded video file.
//
// EmailClient (Resend) is reserved for admin-facing features (e.g. login-adjacent email). No
// scheduling email is ever sent by this app — a Calendly booking gets Calendly's own
// confirmation, directly to the visitor, outside this app.

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
  InMemoryRateLimiter,
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
