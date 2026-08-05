import { toAppError } from '@/modules/shared/lib/errors';
import { err, ok, type Result } from '@/modules/shared/lib/result';
import type { AppointmentService } from './appointment.service';
import type { Appointment } from './appointment.types';

// Thin read-model for the public Upcoming Events tab. Lives in the appointments module because it
// only queries existing Appointment rows (never duplicates the repository's query logic) — the
// visibility gate is the only thing borrowed from the settings module.

export type UpcomingEventsResult = {
  /** Whether the admin has enabled the Upcoming Events tab. When false, `events` is always []. */
  visible: boolean;
  events: Appointment[];
};

export type UpcomingEventsServiceDeps = {
  appointmentService: AppointmentService;
  /** Injected so this stays unit-testable without importing the settings module's container. */
  isUpcomingEventsVisible: () => Promise<boolean>;
  /** Injectable clock for deterministic tests. */
  now?: () => Date;
};

export interface UpcomingEventsService {
  getUpcomingEvents(): Promise<Result<UpcomingEventsResult>>;
}

export function createUpcomingEventsService(deps: UpcomingEventsServiceDeps): UpcomingEventsService {
  const now = deps.now ?? (() => new Date());

  return {
    async getUpcomingEvents() {
      try {
        const visible = await deps.isUpcomingEventsVisible();
        if (!visible) return ok({ visible: false, events: [] });

        const result = await deps.appointmentService.list({
          statusIn: ['approved', 'booked'],
          fromTime: now(),
        });
        if (!result.ok) return result;
        return ok({ visible: true, events: result.data });
      } catch (error) {
        return err(toAppError(error));
      }
    },
  };
}
