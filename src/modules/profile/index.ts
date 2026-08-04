// profile module — singleton professor profile with structured biography fields.
// getProfile() (public) / updateProfile() (admin, audited).

export { updateProfileSchema, type UpdateProfileInput } from './profile.schema';

export type { Profile, ProfileListItem, AuditContext } from './profile.types';

export {
  createProfileService,
  type ProfileService,
  type ProfileServiceDeps,
} from './profile.service';

export type { ProfileRepository } from './profile.repository';

export { getProfileService } from './container';

export { ProfileAffiliations } from './ui/profile-affiliations';
export { ProfileForm } from './ui/profile-form';
