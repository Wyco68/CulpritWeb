# Calendly integration

Two independent pieces coexist in this module:

- **Embed** (`calendly-embed.tsx`) — the public "Make Appointment" page renders the hosted
  scheduling widget. No API calls, no server involvement beyond passing the public scheduling URL.
- **REST integration** (this folder) — server-only, lets the **admin** see/manage Calendly data
  from inside the app: event types, scheduled events, availability, cancellation, and a webhook
  receiver that links Calendly bookings back to local `Appointment` rows.

## Auth: Personal Access Token (PAT)

Single professor account on Calendly's **Free** plan → OAuth is unnecessary complexity. We use a
PAT as a static bearer token, server-only, never exposed to the browser.

**Getting the values:**

1. Log in to Calendly → **Integrations & apps** → **API & Webhooks** → **Get a token now**
   (Personal Access Token). Copy it into `CALENDLY_ACCESS_TOKEN`.
2. `CALENDLY_USER_URI`: `GET https://api.calendly.com/users/me` with that token; use
   `resource.uri` from the response (e.g. `https://api.calendly.com/users/AAAAAAAAAAAAAAAA`).
3. `CALENDLY_WEBHOOK_SIGNING_KEY`: created when you register a webhook subscription (see below);
   Calendly returns/shows the signing key for that subscription.

All three env vars are **optional**. When `CALENDLY_ACCESS_TOKEN` is unset, `CalendlyService.isConfigured()`
returns `false` and every read/write method resolves to an `IntegrationError` ("not configured")
instead of throwing — dev/test boots cleanly with nothing set.

## Supported operations (Free plan)

| Method | Calendly endpoint | Notes |
|---|---|---|
| `getCurrentUser()` | `GET /users/me` | sanity-check the token |
| `getEventTypes()` | `GET /event_types?user=...` | admin's bookable event types |
| `getScheduledEvents(params)` | `GET /scheduled_events?user=...` | filter by `status`, time window |
| `getEventDetails(uri)` | `GET {uri}` | single scheduled event |
| `getAvailability(params)` | `GET /event_type_available_times` | open slots for one event type/window |
| `cancelEvent(uri, reason?)` | `POST {uri}/cancellation` | cancels a scheduled meeting — supported on Free |
| `createBooking()` | — | **not implemented** (see below); returns a structured "not supported" result |
| `processWebhook(body, sig)` | — | verifies + applies `invitee.created` / `invitee.canceled` |

## Free-plan limitations

- **No public create-booking API.** Calendly does not expose an endpoint to programmatically book a
  meeting on any plan (paid or free) — booking always happens through the embedded widget or a
  scheduling link. `createBooking()` therefore never fakes a booking; it returns
  `{ supported: false, reason, schedulingUrl }` so callers can redirect the visitor to the embed
  instead. This is why the in-app "approve request" flow still requires the admin to manually book
  the meeting in Calendly and (optionally) attach the resulting event via the existing
  `calendlyEventRef` field / the admin `book` transition.
- **Webhooks require a paid Calendly plan to *subscribe*** in the Calendly dashboard, per Calendly's
  plan matrix — the receiver below is built and ready, but the subscription itself may not be
  creatable until the account upgrades. Until then, the DB fields (`calendlyEventUri`,
  `calendlyInviteeUri`, etc.) stay null for admin-booked appointments and are only populated if/when
  a webhook is received.

## Webhook configuration

1. Create a webhook subscription (Calendly dashboard or `POST /webhook_subscriptions`) pointing at
   `https://<your-app>/api/integrations/calendly/webhook`, scoped to your user, subscribed to
   `invitee.created` and `invitee.canceled`.
2. Calendly signs each request with `Calendly-Webhook-Signature: t=<unix_ts>,v1=<hmac_sha256_hex>`,
   computed over `"<t>.<raw_body>"` using the subscription's signing key. The route handler reads
   the **raw** request body (`request.text()`, never `request.json()` first) so the HMAC matches
   byte-for-byte, and rejects with `401` on a missing/invalid/expired signature.
3. **Idempotency:** the `appointment.calendly_invitee_uri` column has a `UNIQUE` DB constraint.
   `recordBookingCreated` looks the invitee up first and no-ops if it already exists; replaying the
   same `invitee.created` event twice creates exactly one appointment. `invitee.canceled` is
   likewise a no-op once the appointment is already `cancelled`/`declined`.
4. Unrecognized event types are acknowledged with `200` and no side effects (`handled: false`) so
   Calendly does not retry them forever.

## Endpoints (admin unless noted)

- `GET /api/integrations/calendly/event-types`
- `GET /api/integrations/calendly/events?status=&minStartTime=&maxStartTime=&count=`
- `GET /api/integrations/calendly/availability?eventTypeUri=&startTime=&endTime=`
- `POST /api/integrations/calendly/cancel` `{ eventUri, reason? }`
- `POST /api/integrations/calendly/book` → always `{ supported: false, reason, schedulingUrl }`
- `POST /api/integrations/calendly/webhook` — **public**, signature-verified, idempotent

All responses use the shared `{ ok, data }` / `{ ok, error }` envelope. Raw Calendly payloads are
never forwarded — the service maps everything to the domain types in `calendly.types.ts`.

## How the frontend will consume this (follow-up, not built here)

The admin "Appointments" area can add a panel that calls `event-types`/`events`/`availability`
(TanStack Query) to show Calendly-side context next to in-app requests, and a "Cancel in Calendly"
action wired to `POST /cancel`. This is intentionally out of scope for this backend slice.
