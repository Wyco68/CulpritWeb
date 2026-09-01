/** Fixed IANA zone for the professor's actual meeting location (Chiang Mai University, Thailand).
 *  Event times are meaningful relative to this physical location, not to whoever happens to be
 *  viewing the page — a visitor in another timezone and a server rendering in UTC must both see the
 *  same wall-clock time the admin actually entered. Never format `eventDate` with the runtime's
 *  ambient timezone (`Intl.DateTimeFormat(undefined, ...)`); always pass this explicitly. */
export const INSTITUTION_TIME_ZONE = 'Asia/Bangkok';

/** Bangkok has never observed DST — this offset is a constant, not a snapshot. */
const INSTITUTION_UTC_OFFSET = '+07:00';

/**
 * Parse a `<input type="datetime-local">` value ("YYYY-MM-DDTHH:mm", no zone) as wall-clock time
 * AT THE INSTITUTION, regardless of what timezone the browser/OS/server happens to be set to.
 * Native `new Date(str)` on a zone-less date-time string is ambient — it uses whatever machine
 * runs the parse, so the same admin typing "14:20" gets a different absolute instant depending on
 * their OS clock's zone. Appending the fixed offset makes the instant unambiguous instead.
 * Idempotent: a string that already carries an explicit offset or `Z` suffix (e.g. the ISO string
 * this same value round-trips through when the server re-parses JSON) is passed through as-is —
 * only a bare local string gets the offset appended.
 */
export function parseInstitutionLocalDatetime(value: string): Date {
  const hasExplicitZone = /(?:[+-]\d{2}:?\d{2}|Z)$/.test(value);
  return new Date(hasExplicitZone ? value : `${value}${INSTITUTION_UTC_OFFSET}`);
}

/** Inverse of `parseInstitutionLocalDatetime`: format a Date as the institution's local wall-clock
 *  "YYYY-MM-DDTHH:mm", for prefilling a `datetime-local` input — independent of the viewer's zone. */
export function toInstitutionLocalDatetimeValue(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: INSTITUTION_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}
