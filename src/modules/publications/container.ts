import { PrismaPublicationRepository } from './publication.repository';
import { createPublicationService, type PublicationService } from './publication.service';

// Composition root: wires the Prisma-backed repository into the service. Route handlers call
// getPublicationService() and nothing else.
let cached: PublicationService | undefined;

export function getPublicationService(): PublicationService {
  if (!cached) {
    cached = createPublicationService({ repository: new PrismaPublicationRepository() });
  }
  return cached;
}
