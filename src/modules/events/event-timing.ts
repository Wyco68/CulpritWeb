import type { Event } from './event.types';

// Pure, with no server imports: the public events page re-runs this in the browser against the
// visitor's clock, which is what lets the page be cached like every other public page instead of
// being regenerated every few minutes just to move events from Upcoming to Past.

/**
 * Splits a newest-first list into the two halves the public tab renders. Pure and clock-injectable
 * so the boundary is testable; the page passes no `now`, evaluating it at render time.
 *
 * An event whose date is exactly now counts as upcoming — the boundary has to fall on one side,
 * and "starting right now" is not yet past.
 */
export function splitByTiming(
  events: Event[],
  now: Date = new Date(),
): { upcoming: Event[]; past: Event[] } {
  const upcoming: Event[] = [];
  const past: Event[] = [];
  for (const event of events) {
    if (event.eventDate.getTime() >= now.getTime()) upcoming.push(event);
    else past.push(event);
  }
  // The repository returns newest-first, which is right for past events (most recent first) but
  // backwards for upcoming ones — the next thing happening should lead.
  upcoming.reverse();
  return { upcoming, past };
}
