'use client';

import { type ReactNode } from 'react';
import { NextIntlClientProvider, type Messages } from 'next-intl';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { getQueryClient } from '@/modules/shared/lib/query-client';

// Composed provider tree (outer → inner): i18n → query → (auth, added later).
// No theme provider — the site has one fixed look (navy chrome + light content), matching the
// Figma prototype exactly; light/dark switching is explicitly out of scope.
export function Providers({
  locale,
  messages,
  children,
}: {
  locale: string;
  messages: Messages;
  children: ReactNode;
}) {
  const queryClient = getQueryClient();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster richColors closeButton />
      </QueryClientProvider>
    </NextIntlClientProvider>
  );
}
