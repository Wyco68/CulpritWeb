import { toAppError } from '@/modules/shared/lib/errors';
import { err, ok, type Result } from '@/modules/shared/lib/result';
import { logger as defaultLogger, type Logger } from '@/modules/shared/lib/logger';
import type { ProfileRepository } from './profile.repository';
import type { Profile } from './profile.types';
import type { UpdateProfileInput } from './profile.schema';

export type ProfileServiceDeps = {
  repository: ProfileRepository;
  logger?: Logger;
};

export interface ProfileService {
  getProfile(): Promise<Result<Profile>>;
  updateProfile(input: UpdateProfileInput, actor: string): Promise<Result<Profile>>;
}

export function createProfileService(deps: ProfileServiceDeps): ProfileService {
  const { repository } = deps;
  const log = deps.logger ?? defaultLogger;

  return {
    async getProfile() {
      try {
        return ok(await repository.get());
      } catch (error) {
        return err(toAppError(error));
      }
    },

    async updateProfile(input, actor) {
      try {
        const updated = await repository.updateWithAudit({
          data: input,
          audit: { actor, action: 'profile.update' },
        });
        log.info('profile_updated', { actor });
        return ok(updated);
      } catch (error) {
        return err(toAppError(error));
      }
    },
  };
}
