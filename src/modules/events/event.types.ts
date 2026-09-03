// Domain model — the shape services/routes work with. Mapped from the Prisma row inside the
// repository so Prisma's generated types never leak across the service boundary.
export type Event = {
  id: string;
  title: string;
  description: string;
  eventDate: Date;
  /** Public R2 URLs, in the order the admin arranged them. */
  photoUrls: string[];
  /** YouTube watch/share URLs or bare video IDs — embed-only, never a stored video file. */
  videoUrls: string[];
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Whether an event has happened yet. Derived from `eventDate` at render time — it is NOT stored,
 * because a stored flag would be wrong the moment the clock passed the date with nobody editing.
 */
export type EventTiming = 'upcoming' | 'past';

/**
 * Aggregate counts for the admin dashboard, computed in SQL against an explicit `now` boundary.
 * The boundary is the same one `splitByTiming` applies in memory (an event starting exactly now
 * counts as upcoming), so the dashboard and the public tab can never disagree.
 */
export type EventStats = {
  total: number;
  upcoming: number;
  /** When the next upcoming event starts, or null when nothing is ahead. */
  nextEventDate: Date | null;
};

/** Append-only audit context supplied by the service, persisted by the repository. */
export type AuditContext = {
  actor: string;
  action: string;
  metadata?: Record<string, unknown>;
};
