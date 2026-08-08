import type { Metadata } from 'next';
import { Providers } from './providers';
import './globals.css';

// English-only, no i18n layer at all (removed 2026-08-08): every component uses literal English
// strings — no next-intl, no message catalogue, no locale routing. The site will never support a
// second language, so the translation-lookup indirection had no payoff.

export const metadata: Metadata = {
  title: {
    default: 'The Culprit',
    template: '%s · The Culprit',
  },
  description: 'Personal academic website of an information-security professor.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
