import { defineRouting } from 'next-intl/routing';

// English default. Add locales here later (e.g. 'de', 'fr') — no structural change needed.
export const routing = defineRouting({
  locales: ['en'],
  defaultLocale: 'en',
});

export type Locale = (typeof routing.locales)[number];
