// events module — admin-authored events shown on the public Events tab, split into Upcoming and
// Past by `eventDate` at render time. Replaced the appointments module on 2026-09-01: the public
// Make Appointment tab (Calendly embed) is unaffected and still exists, but nothing a visitor
// books there is recorded locally, so there is no admin-side appointment screen anymore.

export {
  createEventSchema,
  updateEventSchema,
  addParticipantSchema,
  participantIdSchema,
  type CreateEventInput,
  type UpdateEventInput,
  type AddParticipantInput,
} from './event.schema';

export type { Event, EventParticipant, EventTiming, EventStats, AuditContext } from './event.types';

export {
  createEventService,
  splitByTiming,
  type EventService,
  type EventServiceDeps,
  type TeamMemberDirectory,
  type TeamMemberSnapshot,
  type AddParticipantsResult,
} from './event.service';

export type { EventRepository } from './event.repository';

export { getEventService } from './container';

export { EventList } from './ui/event-list';
export { EventTimeline } from './ui/event-timeline';

// Admin UI is NOT re-exported here — admin pages import it by path. Public pages import this barrel
// for its services, and Next ships every client component reachable from a page's imports, used or
// not: re-exporting an admin table here put it (and its zod form schema) on every public page.
