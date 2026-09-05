// Domain model — the shape services/routes work with. Mapped from the Prisma row inside the
// repository so Prisma's generated types never leak across the service boundary.
/**
 * One person who took part in an event — a team member or an outside guest, in one list.
 *
 * `name`/`role`/`photoUrl` are a snapshot taken when the participant was added, NOT a live read
 * through `teamMemberId`. An event is a historical record: renaming a member or changing their
 * title must not rewrite what a past event says, and deleting a member must not blank the row.
 * `teamMemberId` survives only as a soft link, used to stop the same person being added twice.
 */
export type EventParticipant = {
  id: string;
  eventId: string;
  /** Null for a guest, and nulled if the linked team member is later deleted. */
  teamMemberId: string | null;
  name: string;
  role: string | null;
  photoUrl: string | null;
  sortOrder: number;
};

export type Event = {
  id: string;
  title: string;
  /** Short summary, rendered on the card itself. */
  description: string;
  /** Long-form write-up, rendered only in the detail dialog. */
  content: string | null;
  eventDate: Date;
  /** Public R2 URLs, in the order the admin arranged them. */
  photoUrls: string[];
  /** YouTube watch/share URLs or bare video IDs — embed-only, never a stored video file. */
  videoUrls: string[];
  /** In `sortOrder`, then insertion order. Empty for an event nobody has been added to. */
  participants: EventParticipant[];
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

export type { AuditContext } from '@/modules/shared/lib/audit';
