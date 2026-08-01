import { getRequestConfig } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { routing } from './routing';

// Loads the message catalog for the active request. Messages live in /messages/<locale>.json,
// namespaced by module (e.g. "appointments.form.submit").
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    // Explicit default avoids next-intl's ENVIRONMENT_FALLBACK "no timeZone configured" warning
    // (it otherwise falls back to the server's local TZ, which is also non-deterministic across
    // hosts). Appointment times are already rendered/communicated in absolute form elsewhere.
    timeZone: 'UTC',
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
