// profile module — the lab's singleton profile (ADR-016): name, tagline, logo, overview, tab intros.
// getProfile() (public) / updateProfile() (admin, whole document) / patchProfile() (admin,
// per-screen partial write). Both writes are audited.

export {
  updateProfileSchema,
  type UpdateProfileInput,
  patchProfileSchema,
  type PatchProfileInput,
} from './profile.schema';

export { DEFAULT_LAB_NAME, type Profile, type AuditContext } from './profile.types';

export {
  createProfileService,
  type ProfileService,
  type ProfileServiceDeps,
} from './profile.service';

export type { ProfileRepository } from './profile.repository';

export { getProfileService, getProfileCached } from './container';

// Admin UI is NOT re-exported here — admin pages import it by path. Public pages import this barrel
// for its services, and Next ships every client component reachable from a page's imports, used or
// not: re-exporting an admin table here put it (and its zod form schema) on every public page.
