import { cache } from 'react';
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

/**
 * Request-scoped read of the singleton profile, for Server Components only.
 *
 * The public layout renders the profile in the site header and the About page renders the same
 * row again in its body — two components that legitimately don't know about each other, each
 * issuing an identical query, which on a remote Postgres costs a second full round trip for a row
 * already in hand. React's `cache()` memoizes per request, so the layout and the page share one
 * query and still see identical data. Deliberately NOT a cross-request cache: an admin save is
 * visible on the very next request, exactly as before.
 */
export const getProfileCached = cache(async () => getProfileService().getProfile());
