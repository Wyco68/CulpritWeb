import { NotFoundError, toAppError } from '@/modules/shared/lib/errors';
import { err, ok, type Result } from '@/modules/shared/lib/result';
import { logger as defaultLogger, type Logger } from '@/modules/shared/lib/logger';
import type { EventRepository } from './event.repository';
import type { AuditContext, Event } from './event.types';
import type { CreateEventInput, UpdateEventInput } from './event.schema';

// Business layer for Events. An event is plain published content: no status, no lifecycle, no
// approval step, no per-row visibility flag — so unlike the Appointment service it replaced, there
// are no illegal transitions to reject and nothing here returns 409. Every event is public the
// moment it is created.

export type EventServiceDeps = {
  repository: EventRepository;
  logger?: Logger;
};

export interface EventService {
  /** Every event, newest first. */
  list(): Promise<Result<Event[]>>;
  create(input: CreateEventInput, actor: string): Promise<Result<Event>>;
  update(id: string, input: UpdateEventInput, actor: string): Promise<Result<Event>>;
  /** Returns the removed record (pre-delete snapshot) for confirmation. */
  remove(id: string, actor: string): Promise<Result<Event>>;
}

export function createEventService(deps: EventServiceDeps): EventService {
  const { repository } = deps;
  const log = deps.logger ?? defaultLogger;

  return {
    async list() {
      try {
        return ok(await repository.list());
      } catch (error) {
        return err(toAppError(error));
      }
    },

    async create(input, actor) {
      try {
        const audit: AuditContext = { actor, action: 'event.create' };
        const created = await repository.createWithAudit({ data: input, audit });
        log.info('event_created', { id: created.id, actor });
        return ok(created);
      } catch (error) {
        return err(toAppError(error));
      }
    },

    async update(id, input, actor) {
      try {
        const existing = await repository.findById(id);
        if (!existing) return err(new NotFoundError('Event not found.'));

        const audit: AuditContext = { actor, action: 'event.update' };
        const updated = await repository.updateWithAudit({ id, data: input, audit });
        log.info('event_updated', { id, actor });
        return ok(updated);
      } catch (error) {
        return err(toAppError(error));
      }
    },

    async remove(id, actor) {
      try {
        const existing = await repository.findById(id);
        if (!existing) return err(new NotFoundError('Event not found.'));

        // The audit entry carries the full pre-delete state, written inside the same transaction
        // as the delete. An event's description and media list are otherwise unrecoverable — this
        // is the same before-state convention the deleted appointment module used.
        const audit: AuditContext = {
          actor,
          action: 'event.delete',
          metadata: {
            title: existing.title,
            eventDate: existing.eventDate.toISOString(),
            description: existing.description,
            photoUrls: existing.photoUrls,
            videoUrls: existing.videoUrls,
          },
        };
        await repository.deleteWithAudit({ id, audit });
        log.info('event_deleted', { id, actor });
        return ok(existing);
      } catch (error) {
        return err(toAppError(error));
      }
    },
  };
}

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
