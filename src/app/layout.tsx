import type { Metadata } from 'next';
import { Newsreader, Plus_Jakarta_Sans, IBM_Plex_Mono } from 'next/font/google';
import { SITE_URL } from '@/modules/shared/lib/site-url';
import { Providers } from './providers';
import './globals.css';

// English-only, no i18n layer at all (removed 2026-08-08): every component uses literal English
// strings — no next-intl, no message catalogue, no locale routing. The site will never support a
// second language, so the translation-lookup indirection had no payoff.

// Three families, each with one job — see the --font-* tokens in globals.css. Self-hosted by
// next/font at build time (no runtime request to Google, no layout shift, no privacy leak), and
// `display: swap` keeps text readable while a face is still loading.
//
// Newsreader carries the reading voice: an academic profile is a document before it is an
// interface, and a variable text serif with real optical sizing says that in a way the browser
// default stack never could.
const newsreader = Newsreader({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-newsreader',
  axes: ['opsz'],
});

// Interface chrome only — navigation, labels, controls, table headers.
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jakarta',
});

// Data: years, indices, timestamps, identifiers.
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-plex-mono',
  weight: ['400', '500'],
});

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
    <html
      lang="en"
      suppressHydrationWarning
      className={`${newsreader.variable} ${jakarta.variable} ${plexMono.variable}`}
    >
      {/* `100dvh`, not `100vh`: the dynamic unit tracks mobile Safari's collapsing URL bar, so the
          page doesn't jump as the toolbar hides. */}
      <body className="grain min-h-[100dvh] antialiased">
        {/* WCAG 2.1 AA §2.4.1 (Bypass Blocks). Every page puts a masthead and a six-item tab bar
            ahead of the content; without this a keyboard or screen-reader user tabs through all of
            it on every single navigation.
            Revealed by transform rather than `sr-only`/`focus:not-sr-only`: `not-sr-only` resets
            padding to 0, so the focused link rendered as text jammed against the edges of its own
            background. Parked off the top of the viewport instead and slid down on focus — it
            stays in the accessibility tree the whole time, and the slide is compositor-only.
            Note `transition-[translate]`, not `transition-transform`: Tailwind v4 compiles
            `translate-y-*` to the standalone `translate` property, which `transition-transform`
            does not cover — with that class the reveal jumped instead of sliding. */}
        <a
          href="#main"
          className="fixed left-4 top-4 z-50 -translate-y-20 rounded-sm bg-accent px-4 py-2 text-sm font-medium text-accent-foreground shadow-raised transition-[translate] duration-300 ease-[var(--ease-out-expo)] focus:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
