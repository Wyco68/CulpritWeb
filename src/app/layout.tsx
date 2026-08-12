import type { Metadata } from 'next';
import { SITE_URL } from '@/modules/shared/lib/site-url';
import { Providers } from './providers';
import './globals.css';

// English-only, no i18n layer at all (removed 2026-08-08): every component uses literal English
// strings — no next-intl, no message catalogue, no locale routing. The site will never support a
// second language, so the translation-lookup indirection had no payoff.

const SITE_DESCRIPTION = 'Personal academic website of an information-security professor.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'The Culprit',
    template: '%s · The Culprit',
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    title: 'The Culprit',
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: 'The Culprit',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Culprit',
    description: SITE_DESCRIPTION,
  },
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
