import { PrismaResearchRepository } from './research.repository';
import { createResearchService, type ResearchService } from './research.service';

// Composition root: wires the Prisma-backed repository into the service. Route handlers call
// getResearchService() and nothing else.
let cached: ResearchService | undefined;

export function getResearchService(): ResearchService {
  if (!cached) {
    cached = createResearchService({ repository: new PrismaResearchRepository() });
  }
  return cached;
}
