import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale, type Messages } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { Providers } from './providers';
import '../globals.css';

export const metadata: Metadata = {
  title: {
    default: 'The Culprit',
    template: '%s · The Culprit',
  },
  description: 'Personal academic website of an information-security professor.',
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  // Enable static rendering for this request.
  setRequestLocale(locale);
  const messages = (await getMessages()) as Messages;

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <Providers locale={locale} messages={messages}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
