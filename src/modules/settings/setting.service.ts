import { toAppError } from '@/modules/shared/lib/errors';
import { err, ok, type Result } from '@/modules/shared/lib/result';
import { logger as defaultLogger, type Logger } from '@/modules/shared/lib/logger';
import type { SettingRepository } from './setting.repository';
import { SETTING_KEYS, SETTINGS_DEFAULTS, type AuditContext, type Settings } from './setting.types';
import type { UpdateSettingsInput } from './setting.schema';

export type SettingsServiceDeps = {
  repository: SettingRepository;
  logger?: Logger;
};

export interface SettingsService {
  getSettings(): Promise<Result<Settings>>;
  updateSettings(input: UpdateSettingsInput, actor: string): Promise<Result<Settings>>;
  /** Single-key typed read with the documented default applied. Other modules should use this
   *  (or the module-level `getSetting`/`isUpcomingEventsVisible` helpers) instead of raw Prisma. */
  getSetting<K extends keyof Settings>(key: K): Promise<Settings[K]>;
}

function coerceBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function createSettingsService(deps: SettingsServiceDeps): SettingsService {
  const { repository } = deps;
  const log = deps.logger ?? defaultLogger;

  async function readAll(): Promise<Settings> {
    const raw = await repository.getMany(Object.values(SETTING_KEYS));
    return {
      upcomingEventsVisible: coerceBoolean(
        raw[SETTING_KEYS.upcomingEventsVisible],
        SETTINGS_DEFAULTS.upcomingEventsVisible,
      ),
    };
  }

  return {
    async getSettings() {
      try {
        return ok(await readAll());
      } catch (error) {
        return err(toAppError(error));
      }
    },

    async updateSettings(input, actor) {
      try {
        const values: Record<string, unknown> = {
          [SETTING_KEYS.upcomingEventsVisible]: input.upcomingEventsVisible,
        };

        await repository.setManyWithAudit({
          values,
          audit: { actor, action: 'settings.update' } satisfies AuditContext,
        });
        log.info('settings_updated', { actor, keys: Object.keys(values) });
        return ok(await readAll());
      } catch (error) {
        return err(toAppError(error));
      }
    },

    async getSetting(key) {
      const all = await readAll();
      return all[key];
    },
  };
}
