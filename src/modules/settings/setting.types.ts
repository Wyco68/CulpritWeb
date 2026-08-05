// Domain model — the typed view over the key/value Setting table. Only two keys matter today
// (spec §5.3/§7.1); new settings extend this map, not ad-hoc raw reads elsewhere.
export type Settings = {
  upcomingEventsVisible: boolean;
  appointmentDurationMinutes: number;
};

/** DB key each typed setting is stored under. */
export const SETTING_KEYS = {
  upcomingEventsVisible: 'upcoming_events_visible',
  appointmentDurationMinutes: 'appointment_duration_minutes',
} as const satisfies Record<keyof Settings, string>;

/** Defaults applied when a key has no row yet (spec: visible=false, duration=30). */
export const SETTINGS_DEFAULTS: Settings = {
  upcomingEventsVisible: false,
  appointmentDurationMinutes: 30,
};

/** Append-only audit context supplied by the service, persisted by the repository. */
export type AuditContext = {
  actor: string;
  action: string;
  metadata?: Record<string, unknown>;
};
