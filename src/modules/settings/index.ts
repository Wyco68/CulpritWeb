// settings module — key/value flags (upcoming_events_visible, appointment_duration_minutes=30).
// Cross-module code should import getSetting()/isUpcomingEventsVisible() from this surface rather
// than reading the Setting table directly.

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

export {
  getSettingsService,
  getSetting,
  isUpcomingEventsVisible,
  getAppointmentDurationMinutes,
} from './container';

export { SettingsForm } from './ui/settings-form';
