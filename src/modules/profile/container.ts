import { PrismaProfileRepository } from './profile.repository';
import { createProfileService, type ProfileService } from './profile.service';

// Composition root: wires the Prisma-backed repository into the service. Route handlers call
// getProfileService() and nothing else.
let cached: ProfileService | undefined;

export function getProfileService(): ProfileService {
  if (!cached) {
    cached = createProfileService({ repository: new PrismaProfileRepository() });
  }
  return cached;
}
