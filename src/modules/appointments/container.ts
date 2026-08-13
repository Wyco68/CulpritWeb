import { PrismaAppointmentRepository } from './appointment.repository';
import { createAppointmentService, type AppointmentService } from './appointment.service';
import {
  createUpcomingEventsService,
  type UpcomingEventsService,
} from './upcoming-events.service';

// Composition root: wires the Prisma-backed repository into the service. Route handlers call
// getAppointmentService() and nothing else.
let cached: AppointmentService | undefined;

export function getAppointmentService(): AppointmentService {
  if (!cached) {
    cached = createAppointmentService({ repository: new PrismaAppointmentRepository() });
  }
  return cached;
}

// Public read model for the Upcoming Events tab/endpoint (spec §5.1 FR-5, §8.1).
let cachedUpcomingEvents: UpcomingEventsService | undefined;

export function getUpcomingEventsService(): UpcomingEventsService {
  if (!cachedUpcomingEvents) {
    cachedUpcomingEvents = createUpcomingEventsService({
      appointmentService: getAppointmentService(),
    });
  }
  return cachedUpcomingEvents;
}
