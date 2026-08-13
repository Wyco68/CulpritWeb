/** Fixed IANA zone for the professor's actual meeting location (Chiang Mai University, Thailand).
 *  Appointment times are meaningful relative to this physical location, not to whoever happens to
 *  be viewing the page — a visitor in another timezone and a server rendering in UTC must both see
 *  the same wall-clock time the admin actually scheduled. Never format `scheduledAt` with the
 *  runtime's ambient timezone (`Intl.DateTimeFormat(undefined, ...)`); always pass this explicitly. */
export const INSTITUTION_TIME_ZONE = 'Asia/Bangkok';
