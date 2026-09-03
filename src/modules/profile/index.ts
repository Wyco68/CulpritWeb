// profile module — singleton professor profile with structured biography fields.
// getProfile() (public) / updateProfile() (admin, whole document) / patchProfile() (admin,
// per-screen partial write). Both writes are audited.

export {
  updateProfileSchema,
  type UpdateProfileInput,
  patchProfileSchema,
  type PatchProfileInput,
} from './profile.schema';

export type { Profile, AuditContext } from './profile.types';

export {
  createProfileService,
  type ProfileService,
  type ProfileServiceDeps,
} from './profile.service';

export type { ProfileRepository } from './profile.repository';

export { getProfileService, getProfileCached } from './container';

export { ProfileLinks } from './ui/profile-links';
export { ProfileForm } from './ui/profile-form';
