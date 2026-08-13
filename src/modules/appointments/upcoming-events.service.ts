import { toAppError } from '@/modules/shared/lib/errors';
import { err, ok, type Result } from '@/modules/shared/lib/result';
import type { AppointmentService } from './appointment.service';
import type { Appointment } from './appointment.types';

// Thin read-model for the public Upcoming Events tab. Lives in the appointments module because it
// only queries existing Appointment rows (never duplicates the repository's query logic).
// Visibility is per-appointment (`isPublic`, admin-toggled) — there is no global on/off setting.

export type UpcomingEventsResult = {
  events: Appointment[];
};

export type UpcomingEventsServiceDeps = {
  appointmentService: AppointmentService;
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
        const result = await deps.appointmentService.list({
          status: 'scheduled',
          fromTime: now(),
          isPublic: true,
        });
        if (!result.ok) return result;
        return ok({ events: result.data });
      } catch (error) {
        return err(toAppError(error));
      }
    },
  };
}
