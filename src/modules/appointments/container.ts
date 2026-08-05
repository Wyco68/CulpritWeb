import type { CalendlyLinkStore } from '@/modules/integrations';
import { getEmailClient } from '@/modules/integrations';
import { createAppointmentNotifier } from '@/modules/notifications';
import { isUpcomingEventsVisible } from '@/modules/settings';
import { PrismaAppointmentRepository } from './appointment.repository';
import { createAppointmentService, type AppointmentService } from './appointment.service';
import { AppointmentCalendlyLinkStore } from './calendly-link.adapter';
import { PrismaCalendlyLinkRepository } from './calendly-link.repository';
import {
  createUpcomingEventsService,
  type UpcomingEventsService,
} from './upcoming-events.service';

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

// Webhook DB-effects port for the Calendly integration. Creation persists a booked/direct
// appointment; cancellation is routed back through the state machine (see the adapter).
let cachedLinkStore: CalendlyLinkStore | undefined;

export function getCalendlyLinkStore(): CalendlyLinkStore {
  if (!cachedLinkStore) {
    cachedLinkStore = new AppointmentCalendlyLinkStore(
      new PrismaCalendlyLinkRepository(),
      getAppointmentService(),
    );
  }
  return cachedLinkStore;
}

// Public read model for the Upcoming Events tab/endpoint (spec §5.1 FR-5, §8.1).
let cachedUpcomingEvents: UpcomingEventsService | undefined;

export function getUpcomingEventsService(): UpcomingEventsService {
  if (!cachedUpcomingEvents) {
    cachedUpcomingEvents = createUpcomingEventsService({
      appointmentService: getAppointmentService(),
      isUpcomingEventsVisible,
    });
  }
  return cachedUpcomingEvents;
}
