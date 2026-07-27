import { randomBytes } from 'node:crypto';
import { ConflictError, NotFoundError, toAppError } from '@/modules/shared/lib/errors';
import { err, ok, type Result } from '@/modules/shared/lib/result';
import { logger as defaultLogger, type Logger } from '@/modules/shared/lib/logger';
import type {
  AppointmentRepository,
  ListAppointmentsFilter,
  UpdateAppointmentData,
} from './appointment.repository';
import type {
  Appointment,
  AppointmentAction,
  AppointmentEmailKind,
  AppointmentNotifier,
  AuditContext,
} from './appointment.types';
import type {
  AdminBookInput,
  AdminCancelInput,
  AdminDeclineInput,
  AppointmentStatus,
  CancelByTokenInput,
  CreateAppointmentRequestInput,
  CreateDirectBookingInput,
} from './appointment.schema';

// The appointment state machine lives HERE and only here. Routes call these methods; they never
// mutate `status` directly. Illegal moves return a ConflictError → HTTP 409 with no side effects.
//
// Allowed transitions (spec §7.3): declined & cancelled are terminal but retained (never deleted).
export const TRANSITIONS: Record<AppointmentStatus, Partial<Record<AppointmentAction, AppointmentStatus>>> = {
  pending: { approve: 'approved', decline: 'declined' },
  approved: { book: 'booked', cancel: 'cancelled' },
  booked: { cancel: 'cancelled' },
  declined: {},
  cancelled: {},
};

const EMAIL_KIND_BY_STATUS: Record<Exclude<AppointmentStatus, 'pending'>, AppointmentEmailKind> = {
  approved: 'approved',
  declined: 'declined',
  booked: 'booked',
  cancelled: 'cancelled',
};

export type AppointmentServiceDeps = {
  repository: AppointmentRepository;
  notifier: AppointmentNotifier;
  /** Injectable for deterministic tests. Defaults to a crypto-random 32-byte hex token. */
  generateToken?: () => string;
  logger?: Logger;
};

export interface AppointmentService {
  createRequest(input: CreateAppointmentRequestInput): Promise<Result<Appointment>>;
  createDirect(input: CreateDirectBookingInput): Promise<Result<Appointment>>;
  approve(id: string, actor: string): Promise<Result<Appointment>>;
  decline(id: string, input: AdminDeclineInput, actor: string): Promise<Result<Appointment>>;
  book(id: string, input: AdminBookInput, actor: string): Promise<Result<Appointment>>;
  cancelByAdmin(id: string, input: AdminCancelInput, actor: string): Promise<Result<Appointment>>;
  cancelByToken(id: string, input: CancelByTokenInput): Promise<Result<Appointment>>;
  list(filter?: ListAppointmentsFilter): Promise<Result<Appointment[]>>;
}

export function createAppointmentService(deps: AppointmentServiceDeps): AppointmentService {
  const { repository, notifier } = deps;
  const generateToken = deps.generateToken ?? (() => randomBytes(32).toString('hex'));
  const log = deps.logger ?? defaultLogger;

  /** Best-effort email: log-and-continue. A send failure must never roll back committed state. */
  async function notify(kind: AppointmentEmailKind, appointment: Appointment): Promise<void> {
    try {
      await notifier.sendAppointmentEmail(kind, appointment);
    } catch (cause) {
      log.error('appointment_email_failed', { kind, appointmentId: appointment.id, cause: String(cause) });
    }
  }

  /** Shared engine for admin approve/decline/book/cancel and visitor token-cancel. */
  async function applyTransition(params: {
    id: string;
    action: AppointmentAction;
    actor: string;
    calendlyEventRef?: string;
    cancelReason?: string | null;
    guard?: (current: Appointment) => Result<true>;
  }): Promise<Result<Appointment>> {
    try {
      const current = await repository.findById(params.id);
      if (!current) return err(new NotFoundError('Appointment not found.'));

      if (params.guard) {
        const guardResult = params.guard(current);
        if (!guardResult.ok) return guardResult;
      }

      const nextStatus = TRANSITIONS[current.status][params.action];
      if (!nextStatus) {
        return err(
          new ConflictError(`Cannot ${params.action} an appointment that is ${current.status}.`),
        );
      }

      const data: UpdateAppointmentData = { status: nextStatus };
      if (params.action === 'book') data.calendlyEventRef = params.calendlyEventRef;
      // Retain the rationale for both decline and cancel in the single reason column (audit value).
      if (params.action === 'cancel' || params.action === 'decline') {
        data.cancelReason = params.cancelReason ?? null;
      }

      const audit: AuditContext = {
        actor: params.actor,
        action: `appointment.${params.action}`,
        metadata: {
          from: current.status,
          to: nextStatus,
          ...(params.calendlyEventRef ? { calendlyEventRef: params.calendlyEventRef } : {}),
          ...(params.cancelReason ? { hasReason: true } : {}),
        },
      };

      const updated = await repository.updateWithAudit({ id: params.id, data, audit });
      log.info('appointment_transition', { id: updated.id, action: params.action, to: nextStatus });

      const kind = EMAIL_KIND_BY_STATUS[nextStatus as Exclude<AppointmentStatus, 'pending'>];
      await notify(kind, updated);
      return ok(updated);
    } catch (error) {
      return err(toAppError(error));
    }
  }

  return {
    async createRequest(input) {
      try {
        const appointment = await repository.createWithAudit({
          data: {
            requesterName: input.requesterName,
            requesterEmail: input.requesterEmail,
            researchGroup: input.researchGroup ?? null,
            requestedTime: input.requestedTime ?? null,
            topic: input.topic ?? null,
            source: 'request',
            status: 'pending',
            cancelToken: generateToken(),
          },
          audit: { actor: `visitor:${input.requesterEmail}`, action: 'appointment.create.request' },
        });
        log.info('appointment_created', { id: appointment.id, source: 'request' });
        await notify('received_request', appointment);
        return ok(appointment);
      } catch (error) {
        return err(toAppError(error));
      }
    },

    async createDirect(input) {
      try {
        const appointment = await repository.createWithAudit({
          data: {
            requesterName: input.requesterName,
            requesterEmail: input.requesterEmail,
            researchGroup: input.researchGroup ?? null,
            requestedTime: input.requestedTime,
            source: 'direct',
            status: 'booked',
            calendlyEventRef: input.calendlyEventRef,
            cancelToken: generateToken(),
          },
          audit: { actor: `visitor:${input.requesterEmail}`, action: 'appointment.create.direct' },
        });
        log.info('appointment_created', { id: appointment.id, source: 'direct' });
        await notify('received_direct', appointment);
        return ok(appointment);
      } catch (error) {
        return err(toAppError(error));
      }
    },

    approve(id, actor) {
      return applyTransition({ id, action: 'approve', actor });
    },

    decline(id, input, actor) {
      return applyTransition({ id, action: 'decline', actor, cancelReason: input.reason ?? null });
    },

    book(id, input, actor) {
      return applyTransition({ id, action: 'book', actor, calendlyEventRef: input.calendlyEventRef });
    },

    cancelByAdmin(id, input, actor) {
      return applyTransition({ id, action: 'cancel', actor, cancelReason: input.reason });
    },

    cancelByToken(id, input) {
      return applyTransition({
        id,
        action: 'cancel',
        actor: 'visitor:token',
        cancelReason: input.reason ?? null,
        // Token must match the stored one. Return NotFound (not 403) to avoid confirming the id exists.
        guard: (current) =>
          current.cancelToken === input.cancelToken
            ? ok(true)
            : err(new NotFoundError('Appointment not found.')),
      });
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
