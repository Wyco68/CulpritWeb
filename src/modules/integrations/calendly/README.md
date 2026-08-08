# Calendly integration

Embed only. `calendly-embed.tsx` renders Calendly's hosted inline scheduling widget on the public
"Make Appointment" page — a client-side `<iframe>` loaded from `NEXT_PUBLIC_CALENDLY_URL`, nothing
else. There is no server-side Calendly integration in this app: no Personal Access Token, no REST
client, no webhook receiver.

## Why embed-only

A booking made in the widget happens entirely on Calendly's side, including Calendly's own
confirmation email to the visitor — none of that reaches this app. Deliberately: the previous
design attempted a server-side REST integration (reading event types/availability, syncing
cancellations, and eventually a webhook receiver to auto-record direct bookings locally), but
Calendly's webhook subscriptions require the **Standard** tier or above — the Free plan has no
webhook access on any tier. Rather than build and maintain server-side surface area that only
half-works without a paid upgrade, the integration was cut back to exactly what a Free account can
guarantee forever: the public embed widget, which needs no token and no API access at all.

## If a booking should appear on the public site

The public "Upcoming Events" tab is **not** wired to Calendly in any way. If the professor wants a
Calendly booking to show there, they add it manually from **Admin → Manage Appointments** — see
`src/modules/appointments`. That is the only way an appointment enters this app's database.

## Configuration

Only one env var, and it's public (safe to ship to the browser — it's just the scheduling page
URL a visitor would otherwise navigate to directly):

```
NEXT_PUBLIC_CALENDLY_URL=https://calendly.com/your-handle/30min
```

Unset → `CalendlyEmbed` renders a graceful "scheduling unavailable" empty state instead of
crashing the page.
