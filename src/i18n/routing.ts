import { defineRouting } from 'next-intl/routing';

// English default. Add locales here later (e.g. 'de', 'fr') — no structural change needed.
// localePrefix 'as-needed': the default locale ('en') serves at bare paths (/, /appointment) with
// no redirect, cutting one edge-middleware invocation off every landing hit. Old /en/* links still
// resolve via a one-time redirect. Once a second locale is added, next-intl automatically starts
// prefixing non-default locales — no code change needed here.
export const routing = defineRouting({
  locales: ['en'],
  defaultLocale: 'en',
  localePrefix: 'as-needed',
});

export type Locale = (typeof routing.locales)[number];
