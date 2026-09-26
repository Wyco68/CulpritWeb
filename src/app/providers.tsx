'use client';

import { type CSSProperties, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { getQueryClient } from '@/modules/shared/lib/query-client';

// Composed provider tree — query client + toaster. No i18n provider: the app is English-only
// with literal strings in every component (next-intl was removed 2026-08-08 — the site will
// never support a second language, so the translation-lookup indirection had no payoff). No
// theme provider either — one light theme, permanently; there is no dark mode (ADR-018).
const TOAST_TOKENS = {
  '--normal-bg': 'var(--surface)',
  '--normal-border': 'var(--border-strong)',
  '--normal-text': 'var(--foreground)',
  '--success-bg': 'var(--success-tint)',
  '--success-border': 'color-mix(in srgb, var(--success) 25%, transparent)',
  '--success-text': 'var(--success)',
  '--error-bg': 'var(--destructive-tint)',
  '--error-border': 'color-mix(in srgb, var(--destructive) 25%, transparent)',
  '--error-text': 'var(--destructive)',
  '--warning-bg': 'var(--warning-tint)',
  '--warning-border': 'color-mix(in srgb, var(--warning) 30%, transparent)',
  '--warning-text': 'var(--warning)',
  '--info-bg': 'var(--info-tint)',
  '--info-border': 'color-mix(in srgb, var(--info) 25%, transparent)',
  '--info-text': 'var(--info)',
  '--border-radius': 'var(--radius-container)',
} as CSSProperties;

export function Providers({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* Sonner's rich colours re-pointed at the status tokens, so a toast speaks the same palette
          as the status badges instead of the library's own greens and reds. */}
      <Toaster richColors closeButton style={TOAST_TOKENS} />
    </QueryClientProvider>
  );
}
