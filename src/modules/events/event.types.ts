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

/** Append-only audit context supplied by the service, persisted by the repository. */
export type AuditContext = {
  actor: string;
  action: string;
  metadata?: Record<string, unknown>;
};
