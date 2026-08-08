'use client';

import { type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { getQueryClient } from '@/modules/shared/lib/query-client';

// Composed provider tree — query client + toaster. No i18n provider: the app is English-only
// with literal strings in every component (next-intl was removed 2026-08-08 — the site will
// never support a second language, so the translation-lookup indirection had no payoff). No
// theme provider either — one fixed look (navy chrome + light content), matching the Figma
// prototype exactly; light/dark switching is explicitly out of scope.
export function Providers({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster richColors closeButton />
    </QueryClientProvider>
  );
}
