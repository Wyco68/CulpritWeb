'use client';

import { type ReactNode } from 'react';
import { NextIntlClientProvider, type Messages } from 'next-intl';
import { ThemeProvider } from 'next-themes';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { getQueryClient } from '@/modules/shared/lib/query-client';

// Composed provider tree (outer → inner): i18n → theme → query → (auth, added later).
// Order matters: inner providers may read translations/theme.
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
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <QueryClientProvider client={queryClient}>
          {children}
          <Toaster richColors closeButton />
        </QueryClientProvider>
      </ThemeProvider>
    </NextIntlClientProvider>
  );
}
