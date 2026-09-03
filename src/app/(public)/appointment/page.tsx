import type { Metadata } from 'next';
import { getProfileCached } from '@/modules/profile';
import { publicEnv } from '@/modules/shared/lib/env';
import { PageHeading } from '@/modules/shared/ui/page-heading';
import { toMetaDescription } from '../_lib/page-meta';
import { GatedCalendlyEmbed } from './_components/gated-calendly-embed';

// Calendly-embed ONLY: no server-side Calendly integration exists in this app at all — no PAT, no
// REST client, no webhook. A booking made here happens entirely on Calendly's side, including
// Calendly's own confirmation email to the visitor; nothing about it reaches this app or its
// database. If the professor wants a booking to show on the public Events tab, they write it up
// there as an event (ADR-011).
//
// The scheduling link is `profile.calendlyUrl`, editable on the admin Appointment screen, and
// falls back to NEXT_PUBLIC_CALENDLY_URL when that column is blank. It used to be readable only
// from the environment, so changing where visitors booked required a redeploy.
//
// Gated behind a Turnstile check (GatedCalendlyEmbed) — Calendly's Free plan has no bot
// protection and only one bookable event type, so an unprotected embed is a single stream a
// script could fill entirely. See turnstile-challenge.tsx.

const FALLBACK_DESCRIPTION = 'Book a 30-minute meeting directly against live availability.';

export async function generateMetadata(): Promise<Metadata> {
  const profileResult = await getProfileCached();
  return {
    title: 'Make Appointment',
    description: toMetaDescription(
      profileResult.ok ? profileResult.data?.appointmentIntro : null,
      FALLBACK_DESCRIPTION,
    ),
  };
}

export default async function AppointmentPage() {
  // The layout already read the profile this request; this is the same deduplicated read.
  const profileResult = await getProfileCached();
  const profile = profileResult.ok ? profileResult.data : null;
  const intro = profile?.appointmentIntro;
  const schedulingUrl = profile?.calendlyUrl || publicEnv.calendlyUrl;

  return (
    <div>
      <PageHeading title="Make Appointment" />

      {intro && (
        <p className="rise mt-12 max-w-[62ch] text-pretty break-words font-serif text-lg leading-[1.75] text-foreground sm:text-xl">
          {intro}
        </p>
      )}

      {/* Widen past the article column: Calendly's calendar grid is cramped in a narrow column. */}
      <div className="-mx-6 mt-12 sm:mx-0">
        <div className="mx-auto max-w-5xl px-6 sm:px-0">
          <GatedCalendlyEmbed url={schedulingUrl || undefined} minHeight={900} />
        </div>
      </div>
    </div>
  );
}
