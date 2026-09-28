import type { Metadata, Viewport } from 'next';
import { Newsreader, Schibsted_Grotesk } from 'next/font/google';
import { DEFAULT_LAB_NAME, getProfileCached } from '@/modules/profile';
import { SITE_URL } from '@/modules/shared/lib/site-url';
import './globals.css';

// English-only, no i18n layer at all (removed 2026-08-08): every component uses literal English
// strings — no next-intl, no message catalogue, no locale routing. The site will never support a
// second language, so the translation-lookup indirection had no payoff.

// Two families, each with one job — see the --font-* tokens in globals.css. Self-hosted by
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

// Interface chrome — navigation, labels, controls, tables. An editorial grotesk that holds its own
// beside Newsreader instead of disappearing into it (ADR-018).
const schibsted = Schibsted_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-schibsted',
});

const FALLBACK_DESCRIPTION = 'An information-security research lab.';

// The lab's own name and tagline, from the profile, so a tab title and a shared link's preview say
// what the masthead says. A profile edit revalidates `('/', 'layout')`, which refreshes these too.
export async function generateMetadata(): Promise<Metadata> {
  const result = await getProfileCached();
  const profile = result.ok ? result.data : null;
  const labName = profile?.labName || DEFAULT_LAB_NAME;
  const description =
    [profile?.labTagline, profile?.positionAffiliation].filter(Boolean).join(' — ') ||
    FALLBACK_DESCRIPTION;

  return {
    metadataBase: new URL(SITE_URL),
    title: { default: labName, template: `%s · ${labName}` },
    description,
    openGraph: { title: labName, description, url: SITE_URL, siteName: labName, type: 'website' },
    twitter: { card: 'summary_large_image', title: labName, description },
  };
}

// Paints the browser's own chrome — Chrome/Edge on Android, and Safari's toolbars on iOS 15+ — in
// the masthead's pale green, so the band at the top of every page runs straight into the URL bar.
// The literal is the resolved value of `--masthead` (hsl(150 35% 91%)) in globals.css: this is
// emitted into <head> at build time, where a CSS custom property cannot be read. Keep the two in
// step. Single unconditional value, no `media` variants — one light theme, no dark mode (ADR-018).
export const viewport: Viewport = {
  themeColor: '#e0f0e8',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${newsreader.variable} ${schibsted.variable}`}>
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
          className="fixed left-4 top-4 z-50 -translate-y-20 rounded-sm bg-accent px-4 py-2 text-sm font-medium text-accent-foreground shadow-raised transition-[translate] duration-300 ease-[var(--ease-out-expo)] focus-ring focus:translate-y-0"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
