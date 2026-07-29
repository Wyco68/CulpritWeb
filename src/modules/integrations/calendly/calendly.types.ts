// Typed DOMAIN shapes for the Calendly data the app actually needs. Raw Calendly REST payloads are
// mapped to these inside the client/service and never re-exported — so the vendor's response shape
// can change (or the vendor be swapped) without rippling through the domain.

/** The authenticated Calendly account (from GET /users/me). */
export interface CalendlyUser {
  uri: string;
  name: string;
  email: string;
  schedulingUrl: string;
  timezone: string;
}

/** A bookable event type (e.g. "30 Minute Meeting"). */
export interface CalendlyEventType {
  uri: string;
  name: string;
  slug: string;
  active: boolean;
  durationMinutes: number;
  schedulingUrl: string;
  description: string | null;
}

export type CalendlyEventStatus = 'active' | 'canceled';

/** A scheduled meeting on the calendar. */
export interface CalendlyScheduledEvent {
  uri: string;
  name: string;
  status: CalendlyEventStatus;
  startTime: string; // ISO-8601
  endTime: string; // ISO-8601
  eventTypeUri: string | null;
  /** Join URL (e.g. Google Meet / Zoom) when the meeting is virtual. */
  meetingUrl: string | null;
  cancelReason: string | null;
}

/** A person who booked a scheduled event. */
export interface CalendlyInvitee {
  uri: string;
  name: string;
  email: string;
  status: CalendlyEventStatus;
  eventUri: string;
  rescheduled: boolean;
  cancelReason: string | null;
}

/** A single open slot returned by availability lookups. */
export interface CalendlyAvailabilitySlot {
  startTime: string; // ISO-8601
  status: 'available';
  schedulingUrl: string;
}

/** Filters for listing scheduled events. */
export interface ListScheduledEventsParams {
  status?: CalendlyEventStatus;
  /** ISO-8601 lower bound on start time. */
  minStartTime?: string;
  /** ISO-8601 upper bound on start time. */
  maxStartTime?: string;
  count?: number;
}

/** Params for an available-times lookup for one event type. */
export interface AvailabilityParams {
  eventTypeUri: string;
  /** ISO-8601 window start. */
  startTime: string;
  /** ISO-8601 window end. */
  endTime: string;
}

// --- processWebhook domain result --------------------------------------------------------------

export type CalendlyWebhookEventKind = 'invitee.created' | 'invitee.canceled';

export interface CalendlyWebhookResult {
  /** The event type we processed (or the unrecognized event's name). */
  event: string;
  /** true when the event mutated local state; false when ignored or a duplicate. */
  handled: boolean;
  /** true when this exact event was already applied (idempotent replay). */
  duplicate: boolean;
  /** The linked local appointment id, when one was created/updated. */
  appointmentId?: string;
}

// --- createBooking (unsupported on Free) -------------------------------------------------------

/** Structured, honest response for the create-booking capability Calendly does not expose on Free. */
export interface CalendlyBookingUnsupported {
  supported: false;
  reason: string;
  /** The scheduling link the visitor should use instead (embed / hosted page). */
  schedulingUrl: string | null;
}
