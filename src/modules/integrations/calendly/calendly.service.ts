import { z } from 'zod';
import { AppError, IntegrationError, UnauthorizedError, ValidationError, toAppError } from '@/modules/shared/lib/errors';
import { err, ok, type Result } from '@/modules/shared/lib/result';
import { logger as defaultLogger, type Logger } from '@/modules/shared/lib/logger';
import type { CalendlyClient } from './calendly.client';
import { verifyWebhookSignature } from './calendly.webhook';
import type {
  AvailabilityParams,
  CalendlyAvailabilitySlot,
  CalendlyBookingUnsupported,
  CalendlyEventType,
  CalendlyInvitee,
  CalendlyScheduledEvent,
  CalendlyUser,
  CalendlyWebhookResult,
  ListScheduledEventsParams,
} from './calendly.types';

// ALL Calendly communication is encapsulated behind this service interface. It maps raw REST
// payloads to domain shapes, isolates capabilities the Free plan cannot do (createBooking), and
// verifies + idempotently applies webhooks. It NEVER writes appointment status directly — webhook
// effects go through the injected CalendlyLinkStore port (Prisma lives in a repository).

// --- Link store port (webhook DB effects; concrete adapter lives in the appointments module) ----

export interface CalendlyBookingLink {
  inviteeUri: string;
  eventUri: string;
  eventTypeUri: string | null;
  requesterName: string;
  requesterEmail: string;
  scheduledAt: Date;
  meetingUrl: string | null;
}

export interface LinkCreatedResult {
  appointmentId: string;
  /** false when a row for this invitee already existed (idempotent replay). */
  created: boolean;
}

export interface LinkCancelledResult {
  appointmentId: string | null;
  /** false when there was nothing to cancel (unknown invitee or already terminal). */
  cancelled: boolean;
}

/** Idempotent, audited persistence port for Calendly-sourced bookings. */
export interface CalendlyLinkStore {
  recordBookingCreated(link: CalendlyBookingLink): Promise<LinkCreatedResult>;
  /** Applies a Calendly-originated cancellation (webhook path), keyed by invitee uri. */
  recordBookingCancelled(inviteeUri: string, reason: string | null): Promise<LinkCancelledResult>;
  /**
   * Applies an admin-initiated Calendly cancellation (REST `cancelEvent` path), keyed by the
   * scheduled-event uri. Exists so local status is synced synchronously — it never depends on the
   * `invitee.canceled` webhook arriving (webhook subscriptions require a paid Calendly plan).
   */
  reconcileCancellation(eventUri: string, reason: string | null): Promise<LinkCancelledResult>;
}

// --- Service interface -------------------------------------------------------------------------

export interface CalendlyService {
  isConfigured(): boolean;
  getCurrentUser(): Promise<Result<CalendlyUser>>;
  getEventTypes(): Promise<Result<CalendlyEventType[]>>;
  getScheduledEvents(params?: ListScheduledEventsParams): Promise<Result<CalendlyScheduledEvent[]>>;
  getEventDetails(eventUri: string): Promise<Result<CalendlyScheduledEvent>>;
  getAvailability(params: AvailabilityParams): Promise<Result<CalendlyAvailabilitySlot[]>>;
  cancelEvent(eventUri: string, reason?: string): Promise<Result<CalendlyScheduledEvent>>;
  /** Not supported on the Free plan — returns an honest structured result, never a fake booking. */
  createBooking(): Promise<Result<CalendlyBookingUnsupported>>;
  processWebhook(rawBody: string, signatureHeader: string | null): Promise<Result<CalendlyWebhookResult>>;
}

export type CalendlyServiceDeps = {
  /** Undefined when CALENDLY_ACCESS_TOKEN is unset — service reports "not configured". */
  client?: CalendlyClient;
  linkStore: CalendlyLinkStore;
  userUri?: string;
  webhookSigningKey?: string;
  schedulingUrl?: string;
  logger?: Logger;
  now?: () => number;
};

const NOT_CONFIGURED = new IntegrationError('The Calendly integration is not configured.');

// --- Raw payload schemas (kept private; never re-exported) --------------------------------------

const collectionSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.object({ collection: z.array(item) });

const rawUserSchema = z.object({
  uri: z.string(),
  name: z.string().default(''),
  email: z.string().default(''),
  scheduling_url: z.string().default(''),
  timezone: z.string().default(''),
});

const rawEventTypeSchema = z.object({
  uri: z.string(),
  name: z.string().default(''),
  slug: z.string().default(''),
  active: z.boolean().default(false),
  duration: z.number().default(0),
  scheduling_url: z.string().default(''),
  description_plain: z.string().nullish(),
});

const rawEventLocationSchema = z.object({ join_url: z.string().nullish() }).nullish();
const rawScheduledEventSchema = z.object({
  uri: z.string(),
  name: z.string().nullish(),
  status: z.enum(['active', 'canceled']).default('active'),
  start_time: z.string(),
  end_time: z.string(),
  event_type: z.string().nullish(),
  location: rawEventLocationSchema,
  cancellation: z.object({ reason: z.string().nullish() }).nullish(),
});

const rawSlotSchema = z.object({
  status: z.literal('available'),
  start_time: z.string(),
  scheduling_url: z.string().default(''),
});

const webhookEnvelopeSchema = z.object({
  event: z.string(),
  payload: z.object({
    uri: z.string(),
    name: z.string().default(''),
    email: z.string().default(''),
    event: z.string(), // scheduled event uri
    scheduled_event: rawScheduledEventSchema.nullish(),
    cancellation: z.object({ reason: z.string().nullish() }).nullish(),
  }),
});

// --- Mappers ------------------------------------------------------------------------------------

function toUser(raw: z.infer<typeof rawUserSchema>): CalendlyUser {
  return {
    uri: raw.uri,
    name: raw.name,
    email: raw.email,
    schedulingUrl: raw.scheduling_url,
    timezone: raw.timezone,
  };
}

function toEventType(raw: z.infer<typeof rawEventTypeSchema>): CalendlyEventType {
  return {
    uri: raw.uri,
    name: raw.name,
    slug: raw.slug,
    active: raw.active,
    durationMinutes: raw.duration,
    schedulingUrl: raw.scheduling_url,
    description: raw.description_plain ?? null,
  };
}

function toScheduledEvent(raw: z.infer<typeof rawScheduledEventSchema>): CalendlyScheduledEvent {
  return {
    uri: raw.uri,
    name: raw.name ?? '',
    status: raw.status,
    startTime: raw.start_time,
    endTime: raw.end_time,
    eventTypeUri: raw.event_type ?? null,
    meetingUrl: raw.location?.join_url ?? null,
    cancelReason: raw.cancellation?.reason ?? null,
  };
}

function toSlot(raw: z.infer<typeof rawSlotSchema>): CalendlyAvailabilitySlot {
  return { startTime: raw.start_time, status: 'available', schedulingUrl: raw.scheduling_url };
}

/** Wrap a client call: map thrown AppErrors into the Result error branch (no leaks). */
async function guard<T>(logger: Logger, op: string, fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return ok(await fn());
  } catch (error) {
    const appError = toAppError(error);
    if (appError.httpStatus >= 500) logger.error('calendly_service_error', { op, code: appError.code });
    return err(appError);
  }
}

export function createCalendlyService(deps: CalendlyServiceDeps): CalendlyService {
  const logger = deps.logger ?? defaultLogger;
  const { client, linkStore, userUri, webhookSigningKey, schedulingUrl } = deps;

  const requireClient = (): Result<CalendlyClient, AppError> =>
    client ? ok(client) : err(NOT_CONFIGURED);

  // Local closure fn (not `this`) so `processWebhook` can reuse it without depending on the
  // returned interface object's shape/binding.
  const fetchEventDetails = (eventUri: string): Promise<Result<CalendlyScheduledEvent>> => {
    const c = requireClient();
    if (!c.ok) return Promise.resolve(c);
    return guard(logger, 'getEventDetails', async () => {
      const data = await c.data.request<{ resource: unknown }>(eventUri);
      return toScheduledEvent(rawScheduledEventSchema.parse(data.resource));
    });
  };

  return {
    isConfigured(): boolean {
      return Boolean(client);
    },

    async getCurrentUser() {
      const c = requireClient();
      if (!c.ok) return c;
      return guard(logger, 'getCurrentUser', async () => {
        const data = await c.data.request<{ resource: unknown }>('/users/me');
        return toUser(rawUserSchema.parse(data.resource));
      });
    },

    async getEventTypes() {
      const c = requireClient();
      if (!c.ok) return c;
      if (!userUri) return err(new IntegrationError('CALENDLY_USER_URI is not configured.'));
      return guard(logger, 'getEventTypes', async () => {
        const data = await c.data.request<unknown>('/event_types', { query: { user: userUri, count: 100 } });
        return collectionSchema(rawEventTypeSchema).parse(data).collection.map(toEventType);
      });
    },

    async getScheduledEvents(params = {}) {
      const c = requireClient();
      if (!c.ok) return c;
      if (!userUri) return err(new IntegrationError('CALENDLY_USER_URI is not configured.'));
      return guard(logger, 'getScheduledEvents', async () => {
        const data = await c.data.request<unknown>('/scheduled_events', {
          query: {
            user: userUri,
            status: params.status,
            min_start_time: params.minStartTime,
            max_start_time: params.maxStartTime,
            count: params.count ?? 50,
          },
        });
        return collectionSchema(rawScheduledEventSchema).parse(data).collection.map(toScheduledEvent);
      });
    },

    async getEventDetails(eventUri) {
      return fetchEventDetails(eventUri);
    },

    async getAvailability(params) {
      const c = requireClient();
      if (!c.ok) return c;
      return guard(logger, 'getAvailability', async () => {
        const data = await c.data.request<unknown>('/event_type_available_times', {
          query: {
            event_type: params.eventTypeUri,
            start_time: params.startTime,
            end_time: params.endTime,
          },
        });
        return collectionSchema(rawSlotSchema).parse(data).collection.map(toSlot);
      });
    },

    async cancelEvent(eventUri, reason) {
      const c = requireClient();
      if (!c.ok) return c;
      return guard(logger, 'cancelEvent', async () => {
        // Calendly cancellation endpoint lives under the event uri.
        const data = await c.data.request<{ resource: unknown }>(`${eventUri}/cancellation`, {
          method: 'POST',
          body: reason ? { reason } : {},
        });
        const scheduled = toScheduledEvent(rawScheduledEventSchema.parse(data.resource));

        // Sync the local Appointment SYNCHRONOUSLY, in the same request. Webhook subscriptions
        // require a paid Calendly plan (see README), so on Free the `invitee.canceled` webhook may
        // never arrive — local status must not depend on it. Best-effort: no matching local record
        // or an already-terminal one is a safe no-op and must never fail the Calendly-side result,
        // which already succeeded.
        try {
          await linkStore.reconcileCancellation(eventUri, reason ?? null);
        } catch (reconcileError) {
          logger.error('calendly_local_reconcile_failed', { op: 'cancelEvent' });
          void reconcileError;
        }

        return scheduled;
      });
    },

    async createBooking() {
      // Calendly has NO public create-booking API. Booking happens via the embed / scheduling link.
      // We expose the capability honestly so the architecture is ready if a paid plan lands later.
      return ok<CalendlyBookingUnsupported>({
        supported: false,
        reason:
          'Calendly does not offer a public create-booking API on the Free plan. ' +
          'Visitors book through the embedded widget or the scheduling link.',
        schedulingUrl: schedulingUrl ?? null,
      });
    },

    // Replay safety: the signature's timestamp tolerance (default 300s, see calendly.webhook.ts)
    // does NOT by itself prevent replay of a still-fresh, validly-signed payload. Idempotency here
    // relies entirely on the downstream handlers being idempotent — recordBookingCreated no-ops on
    // an existing unique invitee uri, and recordBookingCancelled/reconcileCancellation no-op once
    // the local appointment is already in a terminal state. Do not remove those checks.
    async processWebhook(rawBody, signatureHeader) {
      if (!webhookSigningKey) return err(NOT_CONFIGURED);

      const verification = verifyWebhookSignature(rawBody, signatureHeader, webhookSigningKey, {
        now: deps.now,
      });
      if (!verification.valid) {
        logger.warn('calendly_webhook_rejected', { reason: verification.reason });
        return err(new UnauthorizedError('Invalid webhook signature.'));
      }

      let json: unknown;
      try {
        json = JSON.parse(rawBody);
      } catch {
        return err(new ValidationError('Malformed webhook body.'));
      }

      const parsed = webhookEnvelopeSchema.safeParse(json);
      if (!parsed.success) return err(new ValidationError('Unrecognized webhook payload.'));

      const { event, payload } = parsed.data;

      try {
        if (event === 'invitee.created') {
          // Prefer nested scheduled_event; fall back to fetching event details for start/meeting url.
          let scheduled = payload.scheduled_event ? toScheduledEvent(payload.scheduled_event) : null;
          if (!scheduled && client) {
            const details = await fetchEventDetails(payload.event);
            if (details.ok) scheduled = details.data;
          }
          const result = await linkStore.recordBookingCreated({
            inviteeUri: payload.uri,
            eventUri: payload.event,
            eventTypeUri: scheduled?.eventTypeUri ?? null,
            requesterName: payload.name,
            requesterEmail: payload.email,
            scheduledAt: scheduled ? new Date(scheduled.startTime) : new Date(),
            meetingUrl: scheduled?.meetingUrl ?? null,
          });
          return ok<CalendlyWebhookResult>({
            event,
            handled: result.created,
            duplicate: !result.created,
            appointmentId: result.appointmentId,
          });
        }

        if (event === 'invitee.canceled') {
          const result = await linkStore.recordBookingCancelled(
            payload.uri,
            payload.cancellation?.reason ?? null,
          );
          return ok<CalendlyWebhookResult>({
            event,
            handled: result.cancelled,
            duplicate: !result.cancelled,
            appointmentId: result.appointmentId ?? undefined,
          });
        }

        // Unrecognized event: acknowledge without side effects (idempotent, non-fatal).
        return ok<CalendlyWebhookResult>({ event, handled: false, duplicate: false });
      } catch (error) {
        const appError = toAppError(error);
        logger.error('calendly_webhook_apply_failed', { event, code: appError.code });
        return err(appError);
      }
    },
  };
}

export type { CalendlyInvitee };
