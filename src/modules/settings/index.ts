// settings module — key/value flags (currently just upcoming_events_visible). Cross-module code
// should import getSetting()/isUpcomingEventsVisible() from this surface rather than reading the
// Setting table directly.

export { updateSettingsSchema, type UpdateSettingsInput } from './setting.schema';

export {
  type Settings,
  SETTING_KEYS,
  SETTINGS_DEFAULTS,
  type AuditContext,
} from './setting.types';

export {
  createSettingsService,
  type SettingsService,
  type SettingsServiceDeps,
} from './setting.service';

export type { SettingRepository } from './setting.repository';

export { getSettingsService, getSetting, isUpcomingEventsVisible } from './container';

export { SettingsForm } from './ui/settings-form';
