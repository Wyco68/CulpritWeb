import { PrismaSettingRepository } from './setting.repository';
import { createSettingsService, type SettingsService } from './setting.service';
import type { Settings } from './setting.types';

// Composition root: wires the Prisma-backed repository into the service. Route handlers call
// getSettingsService() directly; other modules that only need a single flag/value should use the
// small helpers below instead of reaching for raw Prisma reads of the Setting table.
let cached: SettingsService | undefined;

export function getSettingsService(): SettingsService {
  if (!cached) {
    cached = createSettingsService({ repository: new PrismaSettingRepository() });
  }
  return cached;
}

/** Typed single-key read with its documented default applied. */
export async function getSetting<K extends keyof Settings>(key: K): Promise<Settings[K]> {
  return getSettingsService().getSetting(key);
}

/** Whether the public Upcoming Events tab/endpoint should be visible (default false). */
export async function isUpcomingEventsVisible(): Promise<boolean> {
  return getSetting('upcomingEventsVisible');
}

/** The default appointment slot duration in minutes (default 30). */
export async function getAppointmentDurationMinutes(): Promise<number> {
  return getSetting('appointmentDurationMinutes');
}
