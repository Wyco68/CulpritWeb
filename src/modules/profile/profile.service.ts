import { attempt, type Result } from '@/modules/shared/lib/result';
import { logger as defaultLogger, type Logger } from '@/modules/shared/lib/logger';
import type { ProfileRepository } from './profile.repository';
import type { Profile } from './profile.types';
import type { PatchProfileInput, UpdateProfileInput } from './profile.schema';

export type ProfileServiceDeps = {
  repository: ProfileRepository;
  logger?: Logger;
};

export interface ProfileService {
  getProfile(): Promise<Result<Profile>>;
  updateProfile(input: UpdateProfileInput, actor: string): Promise<Result<Profile>>;
  /**
   * Write only the supplied fields, leaving every other column alone. Backs the per-tab admin
   * screens, which each own a slice of the singleton and must not clobber the others.
   */
  patchProfile(input: PatchProfileInput, actor: string): Promise<Result<Profile>>;
}

export function createProfileService(deps: ProfileServiceDeps): ProfileService {
  const { repository } = deps;
  const log = deps.logger ?? defaultLogger;

  return {
    getProfile: () => attempt(() => repository.get()),

    updateProfile: (input, actor) =>
      attempt(async () => {
        const updated = await repository.updateWithAudit({
          data: input,
          audit: { actor, action: 'profile.update' },
        });
        log.info('profile_updated', { actor });
        return updated;
      }),

    patchProfile: (input, actor) =>
      attempt(async () => {
        // Which admin screen wrote what is only recoverable from the field list: a partial write
        // touches an arbitrary subset of one row, and the action code alone can't say which.
        // Field NAMES only — never values, which are public site copy but still user content.
        const fields = Object.keys(input);
        const updated = await repository.patchWithAudit({
          data: input,
          audit: { actor, action: 'profile.update', metadata: { fields } },
        });
        log.info('profile_patched', { actor, fields });
        return updated;
      }),
  };
}
