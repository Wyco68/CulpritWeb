// Domain model — the typed view over the key/value Setting table. Only one key matters today;
// new settings extend this map, not ad-hoc raw reads elsewhere.
//
// `appointmentDurationMinutes` used to live here (spec's old direct-booking flow let a visitor
// pick a slot of the admin-configured length). Appointments are now admin-entered only — the
// admin sets the exact start time per appointment, so there is no slot duration to configure.
export type Settings = {
  upcomingEventsVisible: boolean;
};

/** DB key each typed setting is stored under. */
export const SETTING_KEYS = {
  upcomingEventsVisible: 'upcoming_events_visible',
} as const satisfies Record<keyof Settings, string>;

/** Defaults applied when a key has no row yet (spec: visible=false). */
export const SETTINGS_DEFAULTS: Settings = {
  upcomingEventsVisible: false,
};

/** Append-only audit context supplied by the service, persisted by the repository. */
export type AuditContext = {
  actor: string;
  action: string;
  metadata?: Record<string, unknown>;
};
