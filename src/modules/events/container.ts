import { PrismaEventRepository } from './event.repository';
import { createEventService, type EventService } from './event.service';

// Composition root: wires the Prisma-backed repository into the service. Route handlers and
// Server Components call getEventService() and nothing else.
let cached: EventService | undefined;

export function getEventService(): EventService {
  if (!cached) {
    cached = createEventService({ repository: new PrismaEventRepository() });
  }
  return cached;
}
