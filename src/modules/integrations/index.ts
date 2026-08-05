// integrations module — edges behind interfaces: EmailClient (Resend), TurnstileVerifier
// (Cloudflare), RateLimiter (Upstash), StorageAdapter (Supabase Storage). Each has a real
// adapter + a graceful no-op when its env is unset, so dev/test never crash. No domain logic
// lives here.
// (Calendly is embed-only and lives on the frontend. YouTube is likewise embed-only — a
// presentational iframe component + ID parsing utility, no domain wiring yet.)

export { CalendlyEmbed, type CalendlyEmbedProps } from './calendly/calendly-embed';

// Calendly REST integration (embed is separate). Service is the sole entry point for callers.
export { getCalendlyService } from './calendly/calendly.container';
export {
  createCalendlyService,
  type CalendlyService,
  type CalendlyServiceDeps,
  type CalendlyLinkStore,
  type CalendlyBookingLink,
  type LinkCreatedResult,
  type LinkCancelledResult,
} from './calendly/calendly.service';
export { HttpCalendlyClient, type CalendlyClient } from './calendly/calendly.client';
export {
  listScheduledEventsQuerySchema,
  availabilityQuerySchema,
  cancelEventSchema,
  type ListScheduledEventsQuery,
  type AvailabilityQuery,
  type CancelEventInput,
} from './calendly/calendly.schema';
export { verifyWebhookSignature } from './calendly/calendly.webhook';
export type {
  CalendlyUser,
  CalendlyEventType,
  CalendlyScheduledEvent,
  CalendlyInvitee,
  CalendlyAvailabilitySlot,
  CalendlyEventStatus,
  CalendlyWebhookResult,
  CalendlyBookingUnsupported,
  ListScheduledEventsParams,
  AvailabilityParams,
} from './calendly/calendly.types';

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

export {
  type StorageAdapter,
  type StorageBucket,
  PUBLIC_STORAGE_BUCKETS,
  NoopStorageAdapter,
  SupabaseStorageAdapter,
  getStorageAdapter,
} from './storage/storage-adapter';

export { YouTubeVideo, type YouTubeVideoProps } from './youtube/youtube-video';
export { parseYouTubeVideoId } from './youtube/youtube-utils';
