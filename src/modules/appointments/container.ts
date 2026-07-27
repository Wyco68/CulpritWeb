import { getEmailClient } from '@/modules/integrations';
import { createAppointmentNotifier } from '@/modules/notifications';
import { PrismaAppointmentRepository } from './appointment.repository';
import { createAppointmentService, type AppointmentService } from './appointment.service';

// Composition root: wires the Prisma-backed repository + the Resend/no-op notifier into the
// service. Route handlers call getAppointmentService() and nothing else. Kept out of the pure
// service module so the state machine stays trivially unit-testable with fakes.
let cached: AppointmentService | undefined;

export function getAppointmentService(): AppointmentService {
  if (!cached) {
    cached = createAppointmentService({
      repository: new PrismaAppointmentRepository(),
      notifier: createAppointmentNotifier(getEmailClient()),
    });
  }
  return cached;
}
