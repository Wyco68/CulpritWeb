// integrations module — edges behind interfaces: EmailClient (Resend), TurnstileVerifier
// (Cloudflare), RateLimiter (Upstash). Each has a real adapter + a graceful no-op when its env
// is unset, so dev/test never crash. No domain logic lives here.
// (Calendly is embed-only and lives on the frontend; StorageAdapter lands with the profile slice.)

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

export {
  type RateLimiter,
  type RateLimitResult,
  NoopRateLimiter,
  UpstashRateLimiter,
  getRateLimiter,
} from './rate-limit/rate-limiter';

export { guardPublicWrite, type PublicWriteGuardDeps } from './guard/public-write-guard';
