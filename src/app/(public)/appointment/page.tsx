import type { Metadata } from 'next';
import { publicEnv } from '@/modules/shared/lib/env';
import { GatedCalendlyEmbed } from './_components/gated-calendly-embed';

// Calendly-embed ONLY: no server-side Calendly integration exists in this app at all — no PAT, no
// REST client, no webhook. A booking made here happens entirely on Calendly's side, including
// Calendly's own confirmation email to the visitor; nothing about it reaches this app or its
// database. If the professor wants a booking to show on the public Upcoming Events tab, they add
// it there manually from the admin Manage Appointments screen — see modules/appointments.
//
// The widget URL is just the configured scheduling link (NEXT_PUBLIC_CALENDLY_URL) — no
// event-types/current-user lookup, since that would require the REST integration this app
// deliberately does not have.
//
// Gated behind a Turnstile check (GatedCalendlyEmbed) — Calendly's Free plan has no bot
// protection and only one bookable event type, so an unprotected embed is a single stream a
// script could fill entirely. See turnstile-challenge.tsx.

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Make Appointment',
    description: 'Book a 30-minute meeting directly against live availability.',
  };
}

export default async function AppointmentPage() {
  return (
    <div>
      <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Make Appointment</h2>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">
        Pick an open 30-minute slot below. Your booking is confirmed instantly — no approval
        needed.
      </p>

      {/* Widen past the article column: Calendly's calendar grid is cramped in a narrow column. */}
      <div className="-mx-6 mt-8 sm:mx-0">
        <div className="mx-auto max-w-5xl px-6 sm:px-0">
          <GatedCalendlyEmbed url={publicEnv.calendlyUrl || undefined} minHeight={900} />
        </div>
      </div>
    </div>
  );
}
