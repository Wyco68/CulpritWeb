import { ConflictError, NotFoundError, toAppError } from '@/modules/shared/lib/errors';
import { err, ok, type Result } from '@/modules/shared/lib/result';
import { logger as defaultLogger, type Logger } from '@/modules/shared/lib/logger';
import type { AppointmentRepository, ListAppointmentsFilter } from './appointment.repository';
import type { Appointment } from './appointment.types';
import type {
  CancelAppointmentInput,
  CreateAppointmentInput,
  RescheduleAppointmentInput,
  UpdateAppointmentInput,
  UpdateAppointmentVisibilityInput,
} from './appointment.schema';

// No approve/decline/book review queue, and no Calendly sync: an appointment exists ONLY because
// the admin declared it directly. The transitions `scheduled -> cancelled` (cancel) and
// `scheduled -> scheduled` (reschedule: `scheduledAt` only) are enforced HERE and only here.
// Hard delete is a separate, explicit, audited admin action — not a lifecycle transition, so it
// carries no status restriction (see `delete` below).
//
// No notification of any kind is sent from this service. A visitor who books through the Calendly
// embed gets Calendly's own confirmation email, entirely outside this app — see
// src/modules/integrations/calendly/README.md. An admin-declared appointment has no visitor-facing
// email at all, by design: `requesterEmail` on the record is informational only.

export type AppointmentServiceDeps = {
  repository: AppointmentRepository;
  logger?: Logger;
};

export interface AppointmentService {
  /** Declare an appointment directly — the only way one is ever created. */
  create(input: CreateAppointmentInput, actor: string): Promise<Result<Appointment>>;
  /** Edit a scheduled appointment's details. 409 if it has already been cancelled. */
  update(id: string, input: UpdateAppointmentInput, actor: string): Promise<Result<Appointment>>;
  /** `scheduled -> cancelled`. 409 if it is already cancelled. */
  cancel(id: string, input: CancelAppointmentInput, actor: string): Promise<Result<Appointment>>;
  /** `scheduled -> scheduled`: changes `scheduledAt` only. 409 if not currently scheduled. */
  reschedule(
    id: string,
    input: RescheduleAppointmentInput,
    actor: string,
  ): Promise<Result<Appointment>>;
  /** Toggle whether an appointment is shown on the public Upcoming Events tab. */
  updateVisibility(
    id: string,
    input: UpdateAppointmentVisibilityInput,
    actor: string,
  ): Promise<Result<Appointment>>;
  /** Hard-delete an appointment, audited (before-state) first. Not a lifecycle transition — any
   *  status may be deleted. 404 if it doesn't exist. */
  delete(id: string, actor: string): Promise<Result<void>>;
  list(filter?: ListAppointmentsFilter): Promise<Result<Appointment[]>>;
}

export function createAppointmentService(deps: AppointmentServiceDeps): AppointmentService {
  const { repository } = deps;
  const log = deps.logger ?? defaultLogger;

  return {
    async create(input, actor) {
      try {
        const appointment = await repository.createWithAudit({
          data: {
            requesterName: input.requesterName,
            requesterEmail: input.requesterEmail ?? null,
            researchGroup: input.researchGroup ?? null,
            scheduledAt: input.scheduledAt,
            topic: input.topic ?? null,
          },
          audit: { actor, action: 'appointment.create' },
        });
        log.info('appointment_created', { id: appointment.id, actor });
        return ok(appointment);
      } catch (error) {
        return err(toAppError(error));
      }
    },

    async update(id, input, actor) {
      try {
        const current = await repository.findById(id);
        if (!current) return err(new NotFoundError('Appointment not found.'));
        if (current.status !== 'scheduled') {
          return err(new ConflictError('Cannot edit a cancelled appointment.'));
        }

        const updated = await repository.updateWithAudit({
          id,
          data: {
            requesterName: input.requesterName,
            requesterEmail: input.requesterEmail ?? null,
            researchGroup: input.researchGroup ?? null,
            scheduledAt: input.scheduledAt,
            topic: input.topic ?? null,
          },
          audit: { actor, action: 'appointment.update' },
          expectedStatus: 'scheduled',
        });
        log.info('appointment_updated', { id, actor });
        return ok(updated);
      } catch (error) {
        return err(toAppError(error));
      }
    },

    async cancel(id, input, actor) {
      try {
        const current = await repository.findById(id);
        if (!current) return err(new NotFoundError('Appointment not found.'));
        if (current.status !== 'scheduled') {
          return err(new ConflictError('This appointment is already cancelled.'));
        }

        const updated = await repository.updateWithAudit({
          id,
          data: { status: 'cancelled', cancelReason: input.reason },
          audit: { actor, action: 'appointment.cancel', metadata: { from: current.status } },
          expectedStatus: 'scheduled',
        });
        log.info('appointment_cancelled', { id, actor });
        return ok(updated);
      } catch (error) {
        return err(toAppError(error));
      }
    },

    async reschedule(id, input, actor) {
      try {
        const current = await repository.findById(id);
        if (!current) return err(new NotFoundError('Appointment not found.'));
        if (current.status !== 'scheduled') {
          return err(new ConflictError('Only a scheduled appointment can be rescheduled.'));
        }

        const updated = await repository.updateWithAudit({
          id,
          data: { scheduledAt: input.scheduledAt },
          audit: {
            actor,
            action: 'appointment.reschedule',
            metadata: { from: current.scheduledAt, to: input.scheduledAt },
          },
          expectedStatus: 'scheduled',
        });
        log.info('appointment_rescheduled', { id, actor });
        return ok(updated);
      } catch (error) {
        return err(toAppError(error));
      }
    },

    async updateVisibility(id, input, actor) {
      try {
        const current = await repository.findById(id);
        if (!current) return err(new NotFoundError('Appointment not found.'));

        const updated = await repository.updateWithAudit({
          id,
          data: { isPublic: input.isPublic },
          audit: {
            actor,
            action: 'appointment.update_visibility',
            metadata: { from: current.isPublic, to: input.isPublic },
          },
        });
        log.info('appointment_visibility_updated', { id, actor, isPublic: input.isPublic });
        return ok(updated);
      } catch (error) {
        return err(toAppError(error));
      }
    },

    async delete(id, actor) {
      try {
        const current = await repository.findById(id);
        if (!current) return err(new NotFoundError('Appointment not found.'));

        await repository.deleteWithAudit({
          id,
          audit: { actor, action: 'appointment.delete', metadata: { before: current } },
        });
        log.info('appointment_deleted', { id, actor });
        return ok(undefined);
      } catch (error) {
        return err(toAppError(error));
      }
    },

    async list(filter) {
      try {
        return ok(await repository.list(filter));
      } catch (error) {
        return err(toAppError(error));
      }
    },
  };
}
